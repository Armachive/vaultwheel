#!/usr/bin/env python3
"""Read-only vault server for VaultWheel on the site.

Walks VAULT on a timer and serves the folder tree as JSON, lists a folder's files on request, streams pictures, audio
and video for the cards, and pushes tree changes over server-sent events. Needs TREE_TOKEN on every request except
/healthz. Writes nothing but moves and copies (behind the login, journalled, never over anything that is there).
"""
import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import errno
import socket
import struct
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VAULT = os.environ.get("VAULT", "/vault")
TOKEN = os.environ.get("TREE_TOKEN", "")
PORT = int(os.environ.get("PORT", "8110"))
SCAN_EVERY = float(os.environ.get("SCAN_EVERY", "10"))
BASE_PATH = os.environ.get("BASE_PATH", "").rstrip("/")
FRAME_ANCESTORS = os.environ.get("FRAME_ANCESTORS", "'self'")
MAX_SSE = 20
MAX_FILES = 3000
MAX_STREAM = 600 * 1024 * 1024
# the biggest cover picture read out of a song (a few MB covers any real one)
MAX_ART = 6 * 1024 * 1024
# "user:password" for the login, kept base64 in the env (so no character in it needs quoting)
try:
    LOGIN = base64.b64decode(os.environ.get("LOGIN_BASIC", ""), validate=True)
except ValueError:
    LOGIN = b""
JOURNAL = os.environ.get("JOURNAL", "/journal/moves.log")
MOVE_LOCK = threading.Lock()
SCAN_NOW = threading.Event()
TEXT_EXT = {".md", ".txt", ".canvas", ".base", ".json", ".css", ".js", ".py", ".csv", ".log", ".html", ".xml", ".yaml", ".yml", ".ini", ".sh", ".lua", ".ts"}
STREAM_EXT = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
    ".bmp": "image/bmp", ".svg": "image/svg+xml", ".avif": "image/avif",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".flac": "audio/flac",
    ".m4a": "audio/mp4", ".aac": "audio/aac",
    ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
}
HERE = os.path.dirname(os.path.abspath(__file__))

if len(TOKEN) < 16:
    sys.exit("TREE_TOKEN missing or shorter than 16 characters")

COND = threading.Condition()
STATE = {"ver": 0, "hash": "", "payload": b""}
SSE_COUNT = [0]
SSE_LOCK = threading.Lock()


def clean(name):
    return os.fsdecode(name).encode("utf-8", "replace").decode("utf-8")


def ext_key(name):
    """What kind of file a name is, by extension (an Excalidraw drawing is its own kind)."""
    n = name.lower()
    if n.endswith(".excalidraw.md"):
        return "excalidraw.md"
    dot = n.rfind(".")
    return n[dot + 1:] if dot > 0 else ""


def scan(path, name, errs):
    # "t" counts this folder's own files by extension, so a folder's colour bars can be drawn before it is opened
    node = {"n": name, "f": 0, "s": 0, "m": 0, "t": {}, "c": []}
    try:
        with os.scandir(path) as it:
            for e in it:
                # Obsidian does not show dot names (.obsidian, .trash, .git), so neither does the wheel
                if e.name.startswith("."):
                    continue
                try:
                    if e.is_symlink():
                        node["f"] += 1
                        node["s"] += e.stat(follow_symlinks=False).st_size
                    elif e.is_dir(follow_symlinks=False):
                        node["c"].append(scan(e.path, clean(e.name), errs))
                    else:
                        st = e.stat(follow_symlinks=False)
                        node["f"] += 1
                        node["s"] += st.st_size
                        node["m"] = max(node["m"], int(st.st_mtime))
                        k = ext_key(e.name)
                        node["t"][k] = node["t"].get(k, 0) + 1
                except OSError:
                    errs[0] += 1
    except OSError:
        errs[0] += 1
        node["x"] = 1
    node["c"].sort(key=lambda c: (c["n"].startswith("."), c["n"].lower()))
    node["m"] = max([node["m"]] + [c["m"] for c in node["c"]])
    node["tf"] = node["f"] + sum(c["tf"] for c in node["c"])
    node["ts"] = node["s"] + sum(c["ts"] for c in node["c"])
    node["td"] = sum(1 + c["td"] for c in node["c"])
    return node


def scanner():
    root_name = os.environ.get("VAULT_NAME", "vault")
    while True:
        started = time.time()
        # cleared before the scan, so a move made while it runs still wakes the next one
        SCAN_NOW.clear()
        errs = [0]
        try:
            tree = scan(VAULT, root_name, errs)
            body = json.dumps({"root": root_name, "errors": errs[0], "tree": tree},
                              ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            h = hashlib.sha1(body).hexdigest()
            with COND:
                if h != STATE["hash"]:
                    STATE["hash"] = h
                    STATE["payload"] = body
                    STATE["ver"] += 1
                    COND.notify_all()
        except Exception as ex:  # keep the loop alive
            print("scan failed:", repr(ex), flush=True)
        # a move wakes the scan early so the tree catches up at once
        SCAN_NOW.wait(max(1.0, SCAN_EVERY - (time.time() - started)))


def safe_path(rel, want_dir):
    parts = [p for p in rel.split("/") if p not in ("", ".")]
    if any(p == ".." for p in parts) or "\x00" in rel:
        return None
    root = os.path.realpath(VAULT)
    real = os.path.realpath(os.path.join(root, *parts))
    if real != root and not real.startswith(root + os.sep):
        return None
    if want_dir:
        return real if os.path.isdir(real) else None
    return real if os.path.isfile(real) else None


def safe_entry(rel):
    """A file or folder inside the vault (not the vault itself), without following a final symlink."""
    parts = [p for p in rel.split("/") if p not in ("", ".")]
    if not parts or any(p == ".." for p in parts) or "\x00" in rel:
        return None
    root = os.path.realpath(VAULT)
    parent = os.path.realpath(os.path.join(root, *parts[:-1]))
    if parent != root and not parent.startswith(root + os.sep):
        return None
    full = os.path.join(parent, parts[-1])
    return full if os.path.lexists(full) else None


def hidden(path):
    """Obsidian's own folders, the trash and sync folders: never moved, never moved into."""
    rel = os.path.relpath(path, os.path.realpath(VAULT))
    return any(p.startswith(".") for p in rel.split(os.sep) if p not in ("", "."))


def rename_new(src, target):
    """A rename that cannot replace anything, even something that arrives in the last instant. A file gets its new name as a
    hard link, which fails if the name is taken, and then loses the old one. A folder can only go over an empty folder, which
    holds nothing to lose. A disk with no hard links gets the plain rename, with the check just before it as all there is."""
    if os.path.isdir(src) and not os.path.islink(src):
        os.rename(src, target)
        return
    try:
        os.link(src, target, follow_symlinks=False)
    except OSError as ex:
        if ex.errno == errno.EEXIST:
            raise
        os.rename(src, target)
        return
    os.unlink(src)


def move_entry(src_rel, dst_rel):
    """Rename src into the folder dst. Same filesystem, so it is one atomic rename: nothing is copied, nothing is
    rewritten, and an existing name is never replaced. Every move is written to the journal first."""
    with MOVE_LOCK:
        root = os.path.realpath(VAULT)
        src = safe_entry(src_rel)
        dst = safe_path(dst_rel, True)
        if src is None:
            return False, "not found"
        if dst is None:
            return False, "the destination folder was not found"
        if hidden(src) or hidden(dst):
            return False, "system folders cannot be moved or moved into"
        if os.path.dirname(src) == dst:
            return True, "already here"
        real_src = os.path.realpath(src)
        if os.path.isdir(src) and not os.path.islink(src) and (dst == real_src or dst.startswith(real_src + os.sep)):
            return False, "a folder cannot go inside itself"
        target = os.path.join(dst, os.path.basename(src))
        if os.path.lexists(target):
            return False, "something with that name is already there"
        entry = json.dumps({"t": time.strftime("%Y-%m-%d %H:%M:%S"), "from": os.path.relpath(src, root),
                            "to": os.path.relpath(target, root)}, ensure_ascii=False)
        try:
            with open(JOURNAL, "a", encoding="utf-8") as jf:
                jf.write(entry + "\n")
                jf.flush()
                os.fsync(jf.fileno())
        except OSError as ex:
            return False, "the move journal could not be written, so nothing was moved (%s)" % ex.strerror
        if os.path.lexists(target):
            return False, "something with that name is already there"
        try:
            rename_new(src, target)
        except OSError as ex:
            journal_result(entry, False, ex.strerror or "failed")
            return False, ex.strerror or "the move failed"
        journal_result(entry, True, "moved")
        SCAN_NOW.set()
        return True, "moved"


# the most a single copy may write, so a paste of a huge folder cannot fill the disk
MAX_COPY = int(os.environ.get("MAX_COPY", str(2 * 1024 * 1024 * 1024)))
MAX_COPY_FILES = 20000


def copy_entry(src_rel, dst_rel):
    """Copy src into the folder dst (a paste after ctrl + C). It keeps its name unless that is taken there, then it is
    numbered like a duplicate in Obsidian ("name copy", "name copy 2"). Nothing is ever replaced: the copy is made under
    a hidden name first and only renamed into place once it is whole. Every copy is written to the journal first."""
    with MOVE_LOCK:
        root = os.path.realpath(VAULT)
        src = safe_entry(src_rel)
        dst = safe_path(dst_rel, True)
        if src is None:
            return False, "not found", None
        if dst is None:
            return False, "the destination folder was not found", None
        if hidden(src) or hidden(dst):
            return False, "system folders cannot be copied or copied into", None
        if os.path.islink(src):
            return False, "links are not copied", None
        is_dir = os.path.isdir(src)
        real_src = os.path.realpath(src)
        if is_dir and (dst == real_src or dst.startswith(real_src + os.sep)):
            return False, "a folder cannot be copied inside itself", None
        total, count = 0, 0
        if is_dir:
            for top, dirs, files in os.walk(src):
                for f in files:
                    try:
                        total += os.lstat(os.path.join(top, f)).st_size
                    except OSError:
                        pass
                count += len(files) + len(dirs)
                if total > MAX_COPY or count > MAX_COPY_FILES:
                    break
        else:
            total = os.path.getsize(src)
        if total > MAX_COPY or count > MAX_COPY_FILES:
            return False, "too big to copy here", None
        base = os.path.basename(src)
        stem, ext = (base, "") if is_dir else os.path.splitext(base)
        name, i = base, 1
        while os.path.lexists(os.path.join(dst, name)):
            name = stem + (" copy" if i == 1 else " copy %d" % i) + ext
            i += 1
        target = os.path.join(dst, name)
        entry = json.dumps({"t": time.strftime("%Y-%m-%d %H:%M:%S"), "copy": os.path.relpath(src, root),
                            "to": os.path.relpath(target, root)}, ensure_ascii=False)
        try:
            with open(JOURNAL, "a", encoding="utf-8") as jf:
                jf.write(entry + "\n")
                jf.flush()
                os.fsync(jf.fileno())
        except OSError as ex:
            return False, "the journal could not be written, so nothing was copied (%s)" % ex.strerror, None
        tmp = os.path.join(dst, ".vwcopy-" + secrets.token_hex(6))
        try:
            if is_dir:
                shutil.copytree(src, tmp, symlinks=True)
            else:
                shutil.copy2(src, tmp)
                if os.path.getsize(tmp) != os.path.getsize(src):
                    raise OSError(5, "the copy did not come out whole")
            if os.path.lexists(target):
                raise OSError(17, "something with that name arrived meanwhile")
            rename_new(tmp, target)
        except OSError as ex:
            # (only the half made copy under its hidden name is taken away, never anything else)
            try:
                if os.path.isdir(tmp) and not os.path.islink(tmp):
                    shutil.rmtree(tmp, ignore_errors=True)
                elif os.path.lexists(tmp):
                    os.remove(tmp)
            except OSError:
                pass
            journal_result(entry, False, ex.strerror or "failed")
            return False, ex.strerror or "the copy failed", None
        journal_result(entry, True, "copied")
        SCAN_NOW.set()
        return True, "copied", name


def journal_result(entry, ok, msg):
    """A second line after each journalled move, saying whether it happened, so the journal never shows a move that
    failed as if it had been made."""
    try:
        line = json.dumps(dict(json.loads(entry), t=time.strftime("%Y-%m-%d %H:%M:%S"), done=ok, result=msg), ensure_ascii=False)
        with open(JOURNAL, "a", encoding="utf-8") as jf:
            jf.write(line + "\n")
    except (OSError, ValueError):
        pass


def cover_art(path):
    """The picture embedded in an mp3 (ID3v2 APIC / PIC) or flac (PICTURE block), or None."""
    def syncsafe(b):
        return (b[0] << 21) | (b[1] << 14) | (b[2] << 7) | b[3]
    with open(path, "rb") as fh:
        head = fh.read(10)
        if head[:4] == b"fLaC":
            fh.seek(4)
            while True:
                h = fh.read(4)
                if len(h) < 4:
                    return None
                last, kind, length = h[0] & 0x80, h[0] & 0x7F, int.from_bytes(h[1:4], "big")
                if kind == 6:
                    if length > MAX_ART:
                        return None
                    b = fh.read(length)
                    p = 4
                    ml = int.from_bytes(b[p:p + 4], "big"); p += 4 + ml
                    dl = int.from_bytes(b[p:p + 4], "big"); p += 4 + dl + 16
                    n = int.from_bytes(b[p:p + 4], "big"); p += 4
                    return b[p:p + n] or None
                fh.seek(length, 1)
                if last:
                    return None
        if head[:3] != b"ID3" or len(head) < 10:
            return None
        ver, flags, size = head[3], head[5], syncsafe(head[6:10])
        if size > MAX_ART:
            return None
        data = fh.read(size)
    if flags & 0x80 and ver < 4:
        data = data.replace(b"\xff\x00", b"\xff")
    pos = 0
    if flags & 0x40 and ver >= 3:
        pos = syncsafe(data[0:4]) if ver == 4 else int.from_bytes(data[0:4], "big") + 4
    while True:
        if ver == 2:
            if pos + 6 > len(data) or data[pos] == 0:
                return None
            fid, fsize, body_at = data[pos:pos + 3], int.from_bytes(data[pos + 3:pos + 6], "big"), pos + 6
            fflags = b"\x00\x00"
        else:
            if pos + 10 > len(data) or data[pos] == 0:
                return None
            fid = data[pos:pos + 4]
            fsize = syncsafe(data[pos + 4:pos + 8]) if ver == 4 else int.from_bytes(data[pos + 4:pos + 8], "big")
            fflags, body_at = data[pos + 8:pos + 10], pos + 10
        body = data[body_at:body_at + fsize]
        pos = body_at + fsize
        if fid not in (b"APIC", b"PIC"):
            continue
        if ver == 4 and fflags[1] & 0x01:
            body = body[4:]
        if ver == 4 and fflags[1] & 0x02:
            body = body.replace(b"\xff\x00", b"\xff")
        enc = body[0]
        if fid == b"PIC":
            j = 5
        else:
            j = body.index(b"\x00", 1) + 2
        if enc in (1, 2):
            while j + 1 < len(body) and body[j:j + 2] != b"\x00\x00":
                j += 2
            j += 2
        else:
            j = body.index(b"\x00", j) + 1
        return body[j:] or None


def image_type(b):
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    if b[:3] == b"GIF":
        return "image/gif"
    return None


# the pictures' sizes for a folder's listing, read from the first bytes of the file, so the page lays them out right from
# the start. kept per file until it changes
PICTURE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp")
SIZE_MEM = {}
SIZE_MEM_MAX = 100000
# how long one listing spends reading them (the rest are read for the next listing, and the page copes without them)
SIZE_WAIT = 4.0


def jpeg_size(f):
    """Steps over a jpeg's markers to its frame header. A camera's exif orientation of 5 to 8 turns it on its side."""
    turned = False
    f.seek(2)
    for _ in range(64):
        head = f.read(4)
        if len(head) < 4 or head[0] != 0xFF:
            return None
        while head[1] == 0xFF:
            b = f.read(1)
            if not b:
                return None
            head = head[:1] + head[2:] + b
        mk = head[1]
        n = struct.unpack(">H", head[2:4])[0]
        if 0xC0 <= mk <= 0xCF and mk not in (0xC4, 0xC8, 0xCC):
            b = f.read(5)
            if len(b) < 5:
                return None
            h, w = struct.unpack(">HH", b[1:5])
            return (h, w) if turned else (w, h)
        if mk == 0xE1 and n >= 16:
            b = f.read(min(n - 2, 4096))
            turned = turned or exif_turned(b)
            f.seek(n - 2 - len(b), 1)
            continue
        f.seek(n - 2, 1)
    return None


def exif_turned(b):
    try:
        if b[:6] != b"Exif\x00\x00":
            return False
        t = b[6:]
        e = "<" if t[:2] == b"II" else ">"
        ifd = struct.unpack(e + "I", t[4:8])[0]
        for k in range(struct.unpack(e + "H", t[ifd : ifd + 2])[0]):
            at = ifd + 2 + k * 12
            if struct.unpack(e + "H", t[at : at + 2])[0] == 0x0112:
                return struct.unpack(e + "H", t[at + 8 : at + 10])[0] >= 5
    except (struct.error, IndexError):
        pass
    return False


def picture_size(real):
    """A picture's width and height as it shows, from its header (None when it cannot be told)."""
    with open(real, "rb") as f:
        b = f.read(30)
        if b[:8] == b"\x89PNG\r\n\x1a\n" and b[12:16] == b"IHDR":
            return struct.unpack(">II", b[16:24])
        if b[:3] == b"GIF" and len(b) >= 10:
            return struct.unpack("<HH", b[6:10])
        if b[:4] == b"RIFF" and b[8:12] == b"WEBP" and len(b) >= 30:
            if b[12:16] == b"VP8 ":
                w, h = struct.unpack("<HH", b[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if b[12:16] == b"VP8L":
                v = struct.unpack("<I", b[21:25])[0]
                return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
            if b[12:16] == b"VP8X":
                return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")
            return None
        if b[:2] == b"\xff\xd8":
            return jpeg_size(f)
    return None


def size_of(real, st, until):
    key = (st.st_mtime_ns, st.st_size)
    mem = SIZE_MEM.get(real)
    if mem and mem[0] == key:
        return mem[1]
    if time.monotonic() > until:
        return None
    try:
        z = picture_size(real)
    except (OSError, struct.error, ValueError):
        z = None
    if len(SIZE_MEM) > SIZE_MEM_MAX:
        SIZE_MEM.clear()
    SIZE_MEM[real] = (key, z)
    return z


def list_files(rel):
    real = safe_path(rel, True)
    if real is None:
        return None
    out = []
    truncated = False
    until = time.monotonic() + SIZE_WAIT
    try:
        with os.scandir(real) as it:
            for e in it:
                if e.name.startswith("."):
                    continue
                try:
                    if e.is_dir(follow_symlinks=False):
                        continue
                    st = e.stat(follow_symlinks=False)
                    row = [clean(e.name), st.st_size, int(st.st_mtime)]
                    # (a link is not followed, as nothing here follows one out of the vault)
                    if e.name.lower().endswith(PICTURE_EXT) and e.is_file(follow_symlinks=False):
                        z = size_of(e.path, st, until)
                        if z and z[0] > 0 and z[1] > 0:
                            row += [z[0], z[1]]
                    out.append(row)
                except OSError:
                    continue
    except OSError:
        return None
    out.sort(key=lambda r: r[0].lower())
    if len(out) > MAX_FILES:
        out = out[:MAX_FILES]
        truncated = True
    return {"files": out, "truncated": truncated}


class Handler(BaseHTTPRequestHandler):
    server_version = "vault-tree"
    sys_version = ""
    protocol_version = "HTTP/1.1"
    # a connection that sends nothing for this long is closed, so idle sockets cannot pile up threads (the live updates
    # send a ping every 15 s, well inside it)
    timeout = 45

    def log_message(self, fmt, *args):
        # never log the query string, it carries the token
        line = self.requestline.split("?", 1)[0] if self.requestline else "-"
        print("%s %s" % (self.address_string(), line), flush=True)

    def _headers(self, code, ctype, length=None, extra=None, cache=False):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        if length is not None:
            self.send_header("Content-Length", str(length))
        # the browser may keep pictures, songs, videos and cover art (they change only when the file does)
        self.send_header("Cache-Control", "private, max-age=86400" if cache else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                         "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
                         "connect-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:; media-src 'self' blob:; "
                         "frame-ancestors " + FRAME_ANCESTORS)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()

    def _send(self, code, ctype, body):
        self._headers(code, ctype, len(body))
        if self.command != "HEAD":
            self.wfile.write(body)

    def _deny(self, code=403, msg="forbidden"):
        self._send(code, "text/plain; charset=utf-8", msg.encode())

    # the same login as anything else on this address, under the same realm, so a browser that has signed in there
    # sends it here too without asking again
    def _logged_in(self):
        if not LOGIN:
            return True
        h = self.headers.get("Authorization", "")
        if not h.startswith("Basic "):
            return False
        try:
            got = base64.b64decode(h[6:].strip(), validate=True)
        except (ValueError, TypeError):
            return False
        return hmac.compare_digest(got, LOGIN)

    def _ask_login(self):
        time.sleep(0.4)
        body = b"log in to the vault\n"
        self._headers(401, "text/plain; charset=utf-8", len(body), {"WWW-Authenticate": 'Basic realm="Login"'})
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(url.path)
        if BASE_PATH and (path == BASE_PATH or path.startswith(BASE_PATH + "/")):
            path = path[len(BASE_PATH):] or "/"
        q = urllib.parse.parse_qs(url.query)

        if path == "/healthz":
            return self._send(200, "text/plain; charset=utf-8", b"ok")

        given = (q.get("k") or [""])[0]
        if not hmac.compare_digest(given.encode(), TOKEN.encode()):
            time.sleep(0.4)
            return self._deny()
        if not self._logged_in():
            return self._ask_login()

        if path in ("/", "/index.html"):
            with open(os.path.join(HERE, "index.html"), "rb") as fh:
                return self._send(200, "text/html; charset=utf-8", fh.read())

        if path == "/api/themes":
            # the Obsidian themes as the plugin last resolved them (the one file read outside the listing)
            try:
                with open(os.path.join(VAULT, ".obsidian/plugins/vaultwheel/theme-tokens.json"), "rb") as fh:
                    return self._send(200, "application/json; charset=utf-8", fh.read())
            except OSError:
                return self._deny(404, "not found")

        if path == "/api/tree":
            with COND:
                if STATE["ver"] == 0:
                    COND.wait(timeout=30)
                body = STATE["payload"]
            if not body:
                return self._deny(503, "scanning")
            return self._send(200, "application/json; charset=utf-8", body)

        if path == "/api/files":
            res = list_files((q.get("p") or [""])[0])
            if res is None:
                return self._deny(404, "not found")
            return self._send(200, "application/json; charset=utf-8",
                              json.dumps(res, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

        if path == "/api/file":
            return self._stream((q.get("p") or [""])[0])

        if path == "/api/open":
            return self._stream((q.get("p") or [""])[0], any_type=True)

        if path == "/api/art":
            real = safe_path((q.get("p") or [""])[0], False)
            if real is None:
                return self._deny(404, "not found")
            try:
                art = cover_art(real)
            except (OSError, ValueError, IndexError):
                art = None
            kind = image_type(art) if art else None
            if not kind:
                return self._deny(404, "no cover art")
            self._headers(200, kind, len(art), cache=True)
            if self.command != "HEAD":
                self.wfile.write(art)
            return

        if path == "/api/events":
            # a HEAD gets the headers only; it must not sit in the live update loop and take one of its places
            if self.command == "HEAD":
                return self._headers(200, "text/event-stream")
            return self._events()

        return self._deny(404, "not found")

    do_HEAD = do_GET

    def do_POST(self):
        # a refused POST leaves its body unread, so the connection is closed after the answer rather than reading that
        # body as the next request
        self.close_connection = True
        url = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(url.path)
        if BASE_PATH and (path == BASE_PATH or path.startswith(BASE_PATH + "/")):
            path = path[len(BASE_PATH):] or "/"
        q = urllib.parse.parse_qs(url.query)
        given = (q.get("k") or [""])[0]
        if not hmac.compare_digest(given.encode(), TOKEN.encode()):
            time.sleep(0.4)
            return self._deny()
        # moving needs the same login as everything else here, and nothing more
        if not LOGIN:
            return self._deny(403, "moves are off: no login is set up for this server")
        if not self._logged_in():
            return self._ask_login()
        if path not in ("/api/move", "/api/copy"):
            return self._deny(404, "not found")

        def answer(code, ok, msg, name=None):
            body = json.dumps({"ok": ok, "err": None if ok else msg, "msg": msg, "name": name}).encode()
            self._send(code, "application/json; charset=utf-8", body)
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > 64 * 1024:
                return answer(400, False, "bad request")
            req = json.loads(self.rfile.read(length).decode("utf-8"))
            src, dst = str(req["from"]), str(req["to"])
        except (ValueError, KeyError, TypeError):
            return answer(400, False, "bad request")
        if path == "/api/copy":
            try:
                ok, msg, name = copy_entry(src, dst)
            except Exception as ex:  # a failure nobody planned for still gets an answer
                print("copy failed:", repr(ex), flush=True)
                return answer(500, False, "the copy failed")
            print("copy %s -> %s: %s" % (src, dst, name if ok else msg), flush=True)
            return answer(200 if ok else 409, ok, msg, name)
        try:
            ok, msg = move_entry(src, dst)
        except Exception as ex:  # a failure nobody planned for still gets an answer
            print("move failed:", repr(ex), flush=True)
            return answer(500, False, "the move failed")
        print("move %s -> %s: %s" % (src, dst, msg), flush=True)
        return answer(200 if ok else 409, ok, msg)

    def _stream(self, rel, any_type=False):
        # read-only, with byte ranges so audio and video can seek. /api/file serves pictures, audio and video for the
        # cards; /api/open serves any file to look at in its own tab (text shows as plain text, never as a page)
        real = safe_path(rel, False)
        if real is None:
            return self._deny(404, "not found")
        # Obsidian's own folders (.obsidian holds plugin settings, some with keys) are never served to look at
        if any_type and hidden(real):
            return self._deny(404, "not found")
        ext = os.path.splitext(real)[1].lower()
        ctype, extra0 = STREAM_EXT.get(ext), {}
        # an svg can carry script: shown on its own it runs in a sandbox with no script and no requests
        if ext == ".svg":
            extra0["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"
        if not ctype and any_type:
            if ext in TEXT_EXT:
                ctype = "text/plain; charset=utf-8"
            elif ext == ".pdf":
                ctype = "application/pdf"
            else:
                ctype = "application/octet-stream"
                extra0["Content-Disposition"] = "attachment; filename*=UTF-8''" + urllib.parse.quote(os.path.basename(real))
        if not ctype:
            return self._deny(415, "not a picture, audio or video file")
        try:
            size = os.path.getsize(real)
        except OSError:
            return self._deny(404, "not found")
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        m = re.match(r"bytes=(\d*)-(\d*)$", rng or "")
        partial = False
        if m and size and (m.group(1) or m.group(2)):
            a, b = m.group(1), m.group(2)
            # a range that ends before it starts is not a range at all: the whole file is sent (as the HTTP rules say)
            if not (a and b and int(b) < int(a)):
                if a:
                    start = int(a)
                    end = int(b) if b else size - 1
                else:
                    start = max(0, size - int(b))
                end = min(end, size - 1)
                if start > end:
                    self._headers(416, "text/plain", 0, {"Content-Range": "bytes */%d" % size})
                    return
                partial = True
        # the cap is for a whole file sent in one go; a player asking for ranges streams any length in pieces
        if size > MAX_STREAM and not partial:
            return self._deny(413, "too big to stream")
        length = end - start + 1
        extra = dict(extra0, **{"Accept-Ranges": "bytes"})
        if partial:
            extra["Content-Range"] = "bytes %d-%d/%d" % (start, end, size)
        # only pictures, songs and videos are kept by the browser, a note or pdf may be edited any time
        self._headers(206 if partial else 200, ctype, length, extra, cache=ext in STREAM_EXT)
        if self.command == "HEAD":
            return
        try:
            with open(real, "rb") as fh:
                fh.seek(start)
                left = length
                while left > 0:
                    chunk = fh.read(min(256 * 1024, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            # the file shrank while it was sent, so the length promised was not met: the connection cannot be reused
            if left > 0:
                self.close_connection = True
        except (BrokenPipeError, ConnectionResetError, OSError):
            self.close_connection = True

    def _events(self):
        with SSE_LOCK:
            if SSE_COUNT[0] >= MAX_SSE:
                return self._deny(503, "too many listeners")
            SSE_COUNT[0] += 1
        try:
            # a listener that vanished without a goodbye is noticed by the keepalive and frees its place
            self.connection.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
            self._headers(200, "text/event-stream", None, {"X-Accel-Buffering": "no"})
            last = -1
            while True:
                with COND:
                    if STATE["ver"] == last:
                        COND.wait(timeout=15)
                    ver, body = STATE["ver"], STATE["payload"]
                if ver != last and body:
                    self.wfile.write(b"event: tree\ndata: " + body + b"\n\n")
                    last = ver
                else:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with SSE_LOCK:
                SSE_COUNT[0] -= 1


def main():
    threading.Thread(target=scanner, daemon=True).start()
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    print("vault-tree listening on", PORT, "vault:", VAULT, flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
