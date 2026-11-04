# the test browser: headless chromium with webgl through mesa's software renderer, and node for tests/plugintest.js.
# built on demand by tools/testbox.sh, tagged vaultwheel-test, and only ever run as one-shot containers
FROM alpine:3.24
RUN apk add --no-cache chromium mesa-dri-gallium mesa-gl nodejs font-dejavu font-noto-emoji font-noto-symbols fontconfig
