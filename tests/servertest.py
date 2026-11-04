# site/server.py's move and copy on a real temporary folder. not one of runall's suites, which are for the page and the plugin:
#   python3 tests/servertest.py site/server.py
import os, sys, tempfile, importlib.util, json, shutil
root = tempfile.mkdtemp(prefix='vwserver'); vault = root + '/vault'; os.makedirs(vault)
os.environ.update(VAULT=vault, JOURNAL=root + '/moves.log', PORT='0', TREE_TOKEN='x' * 20)
spec = importlib.util.spec_from_file_location('server', sys.argv[1]); s = importlib.util.module_from_spec(spec)
sys.argv = ['server']
spec.loader.exec_module(s)
def w(p, b):
    f = vault + '/' + p; os.makedirs(os.path.dirname(f), exist_ok=True); open(f, 'wb').write(b)
def r(p): return open(vault + '/' + p, 'rb').read()
bad = 0
def T(n, ok, i=''):
    global bad
    print(('PASS ' if ok else 'FAIL ') + n + (' :: ' + str(i) if i else ''))
    if not ok: bad += 1
w('X/A.md', b'A'); w('X/B.md', b'B'); w('Y/B.md', b'other B'); w('F/in.md', b'in'); w('F/.h', b'h'); os.makedirs(vault + '/Z')
T('a move', s.move_entry('X/A.md', 'Z')[0] and r('Z/A.md') == b'A' and not os.path.exists(vault + '/X/A.md'))
ok, msg = s.move_entry('X/B.md', 'Y'); T('a clash is refused', not ok and r('Y/B.md') == b'other B' and r('X/B.md') == b'B', msg)
ok, msg = s.move_entry('F', 'F/sub' if False else 'F'); T('a folder into itself is refused', not ok, msg)
ok, msg = s.move_entry('../outside', 'Z'); T('outside the vault is refused', not ok, msg)
ok, msg = s.move_entry('X/B.md', '../'); T('nor into outside', not ok, msg)
ok, msg, n = s.copy_entry('X/B.md', 'Y'); T('a copy is numbered, nothing replaced', ok and n == 'B copy.md' and r('Y/B copy.md') == b'B' and r('Y/B.md') == b'other B', msg)
ok, msg, n = s.copy_entry('F', 'Y'); T('a folder copy takes everything', ok and r('Y/F/in.md') == b'in' and r('Y/F/.h') == b'h', msg)
ok, msg, n = s.copy_entry('F', 'F'); T('a folder into itself is refused', not ok, msg)
T('no temp left behind', not [x for _, _, fs in os.walk(vault) for x in fs if x.startswith('.vwcopy')] and not [x for _, ds, _ in os.walk(vault) for x in ds if x.startswith('.vwcopy')])
# the last instant: something takes the name after the check
w('X/late.md', b'late'); open(vault + '/Y/late.md', 'wb').write(b'arrived first')
try: s.rename_new(vault + '/X/late.md', vault + '/Y/late.md'); T('rename_new refuses a taken name', False)
except OSError as e: T('rename_new refuses a taken name', e.errno == 17 and r('Y/late.md') == b'arrived first' and r('X/late.md') == b'late', e)
s.rename_new(vault + '/X/late.md', vault + '/Y/fresh.md'); T('and moves when it is free', r('Y/fresh.md') == b'late' and not os.path.exists(vault + '/X/late.md'))
os.makedirs(vault + '/D1'); w('D1/k.md', b'k'); w('D2/k.md', b'kept')
try: s.rename_new(vault + '/D1', vault + '/D2'); T('a folder cannot go over a full folder', False)
except OSError as e: T('a folder cannot go over a full folder', r('D2/k.md') == b'kept' and r('D1/k.md') == b'k', e)
# a disk with no hard links
real = os.link
def nolink(*a, **k): raise OSError(1, 'no hard links here')
os.link = nolink
w('X/n.md', b'n'); s.rename_new(vault + '/X/n.md', vault + '/Y/n.md'); T('a disk with no hard links still moves', r('Y/n.md') == b'n'); os.link = real
# a copy that comes out short is not kept
c2 = shutil.copy2
def short(a, b, **k):
    open(b, 'wb').write(b'x')
shutil.copy2 = short
w('X/long.md', b'long content'); ok, msg, n = s.copy_entry('X/long.md', 'Z'); shutil.copy2 = c2
T('a copy that comes out short is refused and gone', not ok and not os.path.exists(vault + '/Z/long.md') and not [x for x in os.listdir(vault + '/Z') if x.startswith('.vw')], msg)
shutil.rmtree(root)
print('bad', bad)
