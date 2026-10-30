# Norish Chromium image

`norishapp/chromium` runs [fingerprint-chromium](https://github.com/adryfish/fingerprint-chromium)
as a headless CDP server on port 9222. Norish's Chromium browser Page Renderer
connects to it.

The image is linux/amd64 only, because upstream builds Linux for x86_64 only.
Give the container `shm_size: 1gb`. With Docker's default 64 MB of shared
memory, Chromium crashes under concurrent renders.

## Build and bump the pin

`pin.env` and the Dockerfile's `ARG` defaults record the upstream release, its
archive and its digest. To upgrade, change both, bump `CHROMIUM_IMAGE_TAG` and
the tag in `docker/docker-compose.example.yml`, and push. The **Publish browser
images** workflow publishes the new tag and moves `latest` from `main`. It also
publishes upstream's latest release daily as `<version>-norish.1`, so that tag
is often built before the pin moves.

```bash
set -a; . docker/chromium/pin.env; set +a
docker build --platform linux/amd64 docker/chromium -t "norishapp/chromium:$CHROMIUM_IMAGE_TAG"
```

fingerprint-chromium and Chromium are BSD-3, and the image carries both licences
under `/licenses/fingerprint-chromium/`.
