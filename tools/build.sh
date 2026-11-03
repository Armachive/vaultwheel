#!/bin/sh
# build.sh <mode> <out> [light]   mode: snapshot (the artifact, three from the CDN, the vault scan baked in)
#                               live (the site, three from the CDN, no scan: the server supplies it)
#                               bridge (the Obsidian plugin, three inlined as a data url so it works offline and on mobile)
# live and bridge with nothing after <out> are the owner's own builds: the crying gifs and the editors' libraries (three quarters
# of the page, and few visits want them) go in vaultwheel-gifs.json and vaultwheel-vendor.json beside <out>, and the page asks for
# each the first time it wants it. every other build has them in the page
# light keeps one crying gif instead of six and inlines three, so a test build stays small enough for the test container's
# memory and needs no network; public carries no gifs (they are personal), for a release build
# the scan, its thumbnails and the gifs are personal and not in the repo (vault_full.json, am_thumbs.json, gifs.json at its
# root). without them, or with VW_TEST_BUILD=1 (the tests go by the made-up names), the made-up vault in tests/fixture is used
export VW_ROOT="$(dirname "$0")/.."
S=$VW_ROOT
MODE=$1; OUT=$2; LIGHT=$3
mkdir -p "$S/build"; export VW_VENDOR="$S/build/vendor-$$.js"; trap 'rm -f "$VW_VENDOR"' EXIT; sh "$S/tools/vendor-pack.sh" "$VW_VENDOR"  # (a file of its own: runs at once would read each other half written)
perl -0777 -e '
my $S=$ENV{VW_ROOT};
sub slurp { open(my $f,"<:raw",$_[0]) or die "$_[0]"; local $/; my $d=<$f>; close $f; return $d }
my ($mode,$out,$light)=@ARGV[0,1,2];
my $html=slurp("$S/src/vaultwheel.html"); my $js=slurp("$S/src/cards.js");
my $made=$ENV{VW_TEST_BUILD};
my $gifs=slurp(!$made && -f "$S/gifs.json" ? "$S/gifs.json" : "$S/tests/fixture/gifs.json"); chomp $gifs;
if ($light && $light eq "public") { $gifs="[]"; }
elsif ($light) { my $i=index($gifs, "},{\"w\":"); $gifs=substr($gifs, 0, $i + 1) . "]" if $i >= 0; }
my ($data,$th)=("null","{}");
if ($mode eq "snapshot") {
  my ($v,$t)=!$made && -f "$S/vault_full.json" && -f "$S/am_thumbs.json" ? ("$S/vault_full.json","$S/am_thumbs.json") : ("$S/tests/fixture/vault.json","$S/tests/fixture/thumbs.json");
  $data=slurp($v); $th=slurp($t); chomp $data; chomp $th;
}
my $three="https://cdn.jsdelivr.net/npm/three\@0.160.0/build/three.module.min.js";
if ($mode eq "bridge" || $light) { require MIME::Base64; $three="data:text/javascript;base64,".MIME::Base64::encode_base64(slurp("$S/vendor/three-0.160.0.module.min.js"),""); }
for ($js,$data,$th) { s{</}{<\\/}g; }
# the playground lives in its own files and is inlined where the page leaves room for it
if ($html =~ /__PLAYGROUND_JS__/) { my $pj=slurp("$S/src/playground.js"); my $pc=slurp("$S/src/playground.css"); $pj =~ s{</}{<\\/}g; $html =~ s/  __PLAYGROUND_CSS__\n/$pc/ or die "no playground css"; $html =~ s/__PLAYGROUND_JS__\n/$pj/ or die "no playground js"; }
my $ven = -f $ENV{VW_VENDOR} ? slurp($ENV{VW_VENDOR}) : "";
if (!$light && $mode ne "snapshot") {
  my $dir = $out =~ s{[^/]*\z}{}r;
  $ven =~ /^window\.__VENDOR=(.*);\n\z/s or die "no vendor pack";
  for (["gifs",$gifs],["vendor",$1]) { open(my $o,">:raw","${dir}vaultwheel-$_->[0].json") or die; print $o $_->[1]; close $o; }
  $ven = "window.__VW_PACKS=1;"; $gifs = "";
}
$html =~ s/__VENDOR_JS__/$ven/; $html =~ s/__CARDS_JS__/$js/ or die "no js"; $html =~ s/__DATA__/$data/ or die "no data"; $html =~ s/__THUMBS__/$th/ or die "no thumbs"; $html =~ s/__GIFS__/$gifs/ or die "no gifs";
$html =~ s/__MODE__/$mode/ or die "no mode"; $html =~ s/__THREE_SRC__/$three/ or die "no three";
open(my $o,">:raw",$out) or die; print $o $html; close $o; print "built $mode -> $out ", -s $out, " bytes\n";' "$MODE" "$OUT" "$LIGHT"
# (the plugin sends nothing out: its font goes in the page. the site and the preview take it from Google)
if [ "$MODE" = bridge ]; then perl "$(dirname "$0")/font-inline.pl" "$OUT" "$(dirname "$0")/../vendor/fonts"; fi
