# Third-party libraries

Each one is the unmodified browser build from its npm package, checked against the package's published sha512 before it
was copied here. tools/build.sh inlines them into the page where `__VENDOR_JS__` sits, so the editors work offline and on
phones. They are reskinned with CSS only.

| file | package | version | licence |
|---|---|---|---|
| cropper-1.6.2.min.js, cropper-1.6.2.min.css | cropperjs | 1.6.2 | MIT (LICENSE.cropperjs) |
| clip/clip.html | Clip (maarudth/clip, commit in clip/COMMIT.txt) | | MIT (clip/LICENSE.clip) |
| clip/mp4-muxer-5.0.1.mjs | mp4-muxer | 5.0.1 | MIT (clip/LICENSE.mp4-muxer); the module Clip imports for its mp4 export |
| clip/gifenc-1.0.3.esm.js | gifenc | 1.0.3 | MIT (clip/LICENSE.gifenc); the module Clip imports for its gif export |
| audiomass/ (sources as in its index.html, lame.js, wav.js, main.css, fonts/icomoon.woff) | AudioMass | commit in audiomass/COMMIT.txt | MIT (LICENSE.audiomass; its bundled libraries in audiomass/THIRD_PARTY_NOTICES.md: wavesurfer 2.0.5 BSD-3, lame.js LGPL) |

Each library is inlined as text and only run the first time its editor opens, so the page pays nothing for them until then.

## In the plugin build, always

| file | what | licence |
|---|---|---|
| three-0.160.0.module.min.js | three.js r160, from its npm package: the 3D scene, inlined in the plugin's builds and in test builds | MIT (LICENSE.three) |
| fonts/ | Libre Baskerville, the files Google Fonts serves, inlined by tools/font-inline.pl | SIL Open Font License 1.1 (fonts/OFL.txt) |

## What AudioMass bundles

audiomass/LICENSES.bundled.txt has the text for each. wavesurfer.js 2.0.5 and its regions plugin are BSD-3-Clause, the LZ4 codec
in lzma.js is BSD-2-Clause. audiomass/lame.js is lamejs, under the LGPL 3.0 (LICENSE.lgpl-3.0.txt, LICENSE.gpl-3.0.txt, its
source at https://github.com/zhuker/lamejs): it writes mp3s. Everything else in this list allows redistribution with its
notice kept; the LGPL also asks that someone can swap the library, which the source being open and tools/release.sh allow.
tools/release.sh puts these notices and licences at the end of main.js, since the store installs nothing else.

## Network

The editors make no calls of their own in the plugin. AudioMass's Load From URL and Help are removed from its menus when it
opens and Clip's two module imports from CDNs are replaced by the copies here (playground.js). Clip's only fetch is of the
video's own blob link.
