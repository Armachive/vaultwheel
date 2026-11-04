#!/bin/sh
# tools/release.sh [version]   makes the three files the Obsidian community store installs, and nothing else, in build/release/:
#   main.js: plugin/main.js without its development parts (the "#if dev" regions: reloading itself and swapping in a page from
#     the plugin folder), the licences, and the page built in, gzipped and in base64 (see unpackPage in main.js)
#   manifest.json: the one at the repo root
#   styles.css: plugin/styles.css
# the page is the bridge build with no crying gifs and no scan of any vault. the version defaults to the root manifest's; given,
# it must agree with the root manifest and versions.json, so a release cannot go out with a wrong number. nothing is published:
# attaching these to a GitHub release and the store pull request are done by hand, when the owner says so
set -e
S=$(cd "$(dirname "$0")/.." && pwd)
WANT=$(perl -ne 'print $1 if /"version":\s*"([^"]+)"/' "$S/manifest.json")
V=${1:-$WANT}
[ "$V" = "$WANT" ] || { echo "the root manifest.json says $WANT, not $V"; exit 1; }
MIN=$(perl -ne 'print $1 if /"minAppVersion":\s*"([^"]+)"/' "$S/manifest.json")
grep -q "\"$V\": *\"$MIN\"" "$S/versions.json" || { echo "versions.json needs \"$V\": \"$MIN\""; exit 1; }
cmp -s "$S/manifest.json" "$S/plugin/manifest.json" || { echo "manifest.json and plugin/manifest.json differ"; exit 1; }
[ -f "$S/LICENSE" ] || { echo "no LICENSE"; exit 1; }
O=$S/build/release; mkdir -p "$S/build"; T=$(mktemp -d "$S/build/release-XXXXXX"); trap 'rm -rf "$T"' EXIT
sh "$S/tools/build.sh" bridge "$T/page.html" public >/dev/null
# three's own minified build of the same version is half the size
perl -0777 -e '
use MIME::Base64;
my ($page, $min) = @ARGV;
sub slurp { open(my $f, "<:raw", $_[0]) or die "$_[0]: $!"; local $/; my $d = <$f>; close $f; return $d }
my $h = slurp($page), my $m = encode_base64(slurp($min), "");
$h =~ s{from \x27data:text/javascript;base64,[A-Za-z0-9+/=]+\x27}{from \x27data:text/javascript;base64,$m\x27} or die "no inlined three in the page\n";
open(my $o, ">:raw", $page) or die; print $o $h; close $o;' "$T/page.html" "$S/vendor/three-0.160.0.module.min.js"
# what must never ship, looked for in the page and in the plugin. a word here is the list of what the build is checked against,
# so it stays out of the files themselves
perl -0777 -e '
my ($page, @bad) = @ARGV;
sub slurp { open(my $f, "<:raw", $_[0]) or die "$_[0]: $!"; local $/; my $d = <$f>; close $f; return $d }
my $h = slurp($page);
$h =~ /id="cryData">\[\]</ or die "the page carries crying gifs\n";
$h =~ /const MODE = \x27bridge\x27/ or die "the page is not a bridge build\n";
die "the page names Google Fonts or a CDN\n" if $h =~ /fonts\.(googleapis|gstatic)\.com/ or $h =~ /from \x27https?:/;
for my $w (@bad) { die "\"$w\" is in the page\n" if $h =~ /\Q$w\E/i; }' "$T/page.html" $(cat "$S/tools/private-words" 2>/dev/null)
# the licences, for main.js: the store installs nothing else, and the licences ask to travel with the code
{
  printf '\n/* Licences. VaultWheel is under the MIT licence:\n\n'; cat "$S/LICENSE"
  for f in vendor/NOTICE.md vendor/LICENSE.cropperjs vendor/LICENSE.three vendor/LICENSE.audiomass vendor/audiomass/THIRD_PARTY_NOTICES.md vendor/audiomass/LICENSES.bundled.txt vendor/clip/LICENSE.clip vendor/clip/LICENSE.mp4-muxer vendor/clip/LICENSE.gifenc vendor/fonts/OFL.txt vendor/LICENSE.lgpl-3.0.txt vendor/LICENSE.gpl-3.0.txt; do
    printf '\n\n===== %s =====\n\n' "$f"; cat "$S/$f"
  done
} | perl -0777 -pe 's{\*/}{* /}g' > "$T/licences.js"
# (anything in a licence that looks like the end of this comment is spaced out just above, so the only one is this)
printf '\n*/\n' >> "$T/licences.js"
perl -e '
my ($src, $v) = @ARGV; open(my $f, "<:raw", $src) or die; my $skip = 0;
print "/* VaultWheel $v. Built by tools/release.sh from the source at https://github.com/Armachive/vaultwheel. The page the plugin\n   shows (its HTML, CSS and JavaScript, with the libraries named in the licences below) is the string VW_PAGE at the end of this\n   file, gzipped and in base64, so that this file stays small. To read it: base64 -d | gunzip. */\n";
while (<$f>) { if (/^\s*\/\/ #if dev\s*$/) { die "a region inside a region\n" if $skip; $skip = 1; next; } if (/^\s*\/\/ #endif\s*$/) { die "an end with no region\n" unless $skip; $skip = 0; next; } print unless $skip; }
die "a region with no end\n" if $skip;' "$S/plugin/main.js" "$V" > "$T/main.js"
cat "$T/licences.js" >> "$T/main.js"
gzip -9nc "$T/page.html" > "$T/page.gz"
{ printf '// the page, built in (see unpackPage)\nconst VW_PAGE = "'; base64 -w0 "$T/page.gz"; printf '";\n'; } >> "$T/main.js"
# back to what went in, and none of what a store build must not hold
perl -0777 -e '
use MIME::Base64;
my ($main, $page) = @ARGV;
sub slurp { open(my $f, "<:raw", $_[0]) or die "$_[0]: $!"; local $/; my $d = <$f>; close $f; return $d }
my $m = slurp($main);
my ($b) = $m =~ /const VW_PAGE = "([A-Za-z0-9+\/=]+)";\n\z/ or die "no VW_PAGE at the end of main.js\n";
require IO::Uncompress::Gunzip; my $out; my $gz = decode_base64($b);
IO::Uncompress::Gunzip::gunzip(\$gz => \$out) or die "the page does not unpack\n";
$out eq slurp($page) or die "the page does not unpack to what went in\n";
(my $code = $m) =~ s/\n\/\* Licences\..*\z//s;
for my $w (qw(disablePlugin enablePlugin loadManifests watchUpdates checkMain vaultwheel.html)) { die "$w is still in the store build\n" if index($code, $w) >= 0; }
die "the source main.js has no end line\n" if index($code, "// end of main.js") < 0;
' "$T/main.js" "$T/page.html"
rm -rf "$O"; mkdir -p "$O"
cp "$T/main.js" "$O/main.js"; cp "$S/manifest.json" "$O/manifest.json"; cp "$S/plugin/styles.css" "$O/styles.css"
ls -l "$O"; echo "page $(wc -c < "$T/page.html") bytes, $(wc -c < "$T/page.gz") gzipped"
