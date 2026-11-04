#!/usr/bin/perl
# font-inline.pl <page.html> <fonts dir>   the plugin sends nothing out, so a bridge page has its font built in: the page's two
# preconnects and the script that adds Google's stylesheet make way for vendor/fonts/fonts.css with its files as data urls.
# the site and the preview keep Google's. a page whose head has changed stops the build instead of quietly going online
use strict; use warnings; use MIME::Base64;
my ($page, $dir) = @ARGV;
sub slurp { open(my $f, '<:raw', $_[0]) or die "$_[0]: $!"; local $/; my $d = <$f>; close $f; return $d }
my $html = slurp($page), my $css = slurp("$dir/fonts.css");
$css =~ s{/\*.*?\*/\s*}{}s;
$css =~ s{url\(([\w.-]+\.woff2)\)}{'url(data:font/woff2;base64,' . encode_base64(slurp("$dir/$1"), '') . ')'}ge;
my $head = "<style>\n$css</style>\n<script>window.vwFontCss = Promise.resolve();</script>\n";
$html =~ s{<link rel="preconnect" href="https://fonts\.googleapis\.com">\n<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\n<script>\n.*?window\.vwFontCss = new Promise.*?</script>\n}{$head}s or die "font-inline: the page's font head is not as expected\n";
die "font-inline: the page still names Google Fonts\n" if $html =~ /fonts\.(googleapis|gstatic)\.com/;
open(my $o, '>:raw', $page) or die; print $o $html; close $o;
