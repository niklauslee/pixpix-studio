# Pixpix Studio

👉 https://pixpix-studio.niklauslee.workers.dev/

Three super-simple editors for embedded devices with monochrome displays.

## Scene editor

![Scene Editor](https://github.com/niklauslee/pixpix-studio/blob/main/public/images/scene-editor.png?raw=true)

Draws a scene into a packed 1-bpp pixel buffer, like a real display
framebuffer.

- Support various shapes (rectangle, ellipse, line, polygon, text, free drawing)
- [u8g2](https://github.com/olikraus/u8g2) C/C++ code generation
- XBM (X Bitmap) code generation

## Font editor

![Font Editor](https://github.com/niklauslee/pixpix-studio/blob/main/public/images/font-editor.png?raw=true)

A BDF glyph editor for creating and editing bitmap fonts.

- Edit glyph bitmaps on the font's bounding box grid
- Import / export BDF fonts
- Preview text rendered with the font

## Icon editor

![Icon Editor](https://github.com/niklauslee/pixpix-studio/blob/main/public/images/icon-editor.png?raw=true)

An editor for icon sets — many named icon bitmaps sharing one fixed size.

- Edit icon bitmaps on a shared, resizable grid
- [u8g2](https://github.com/olikraus/u8g2) XBM C byte array code generation
- Export all icons at once, or just the selected one

## Dashboard

Sign in with GitHub to save scenes, fonts and icon sets to your account and
manage them from one place.

- Create, rename, delete, download and upload scenes, fonts and icon sets
- Open a saved scene, font or icon set straight into its editor
- Everything is scoped to your account — nobody else can see or edit it

## Build

```sh
# clone repository
$ git clone https://github.com/niklauslee/pixpix-studio.git
$ cd pixpix-studio

# install all dependencies
$ npm install

# run app
$ npm run dev
```

Signing in and saving to the dashboard needs a GitHub OAuth app and a
Cloudflare D1 database configured locally (`.dev.vars`, `wrangler.jsonc`) —
see `AGENTS.md` for details. The editors themselves work without any of that.

## Remote database (Cloudflare D1)

Deploying the dashboard needs a remote D1 database, created once per
Cloudflare account:

```sh
# create the remote D1 database
$ npx wrangler d1 create pixpix-studio
```

Copy the `database_id` printed by that command into the `d1_databases` entry
in `wrangler.jsonc`, then apply the migrations under `drizzle/migrations` to
it:

```sh
$ npx wrangler d1 migrations apply DB --remote
```

Production also needs its own copies of the secrets from `.dev.vars`
(`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `BETTER_AUTH_SECRET`), set as
Worker secrets:

```sh
$ npx wrangler secret put GITHUB_CLIENT_ID
$ npx wrangler secret put GITHUB_CLIENT_SECRET
$ npx wrangler secret put BETTER_AUTH_SECRET
```

Then build and deploy the Worker:

```sh
$ npm run build
$ npx wrangler deploy
```

## Contribution

Please note that this project is **not open contribution**, so we do not accept any pull requests.

## License

Pixpix Studio is distributed under the _Apache License 2.0_. See the [LICENSE](./LICENSE.md) file for more details.
