# Hyperdrive-x

A hyperdrive-next with extra features, somewhat similar to the late hyperdrive 10; and with typings.

> The new https://github.com/holepunchto/hyperdrive-next is focused more on file sharing.

It's just an extension of the new hyperdrive-next to include some/most hyperdrive 10 apis to atleast satisfy my [hyp-files-app](https://github.com/Anyass3/hyp-files-app) project.

## Installation

Install with npm/pnpm:

```
pnpm i github:Anyass3/hyperdrive-x
```

## API

Checkout (hyperdrive api docs)[https://docs.holepunch.to/building-blocks/hyperdrive]

Only the changed and extended apis will be documented here.

```
const drive = new Hyperdrive(corestore, key?: string | Buffer, localDriveRoot?: string)
```
key should be a Hypercore public key in either hex string or buffer. 

localDriveRoot is needed in case you want export and import between your local fs system and hyperdrive. This defaults to current directory (ie `./`).

## overrides 

#### readdir

```js
drive.readdir(path: string, [opts])
```
opts
```
{ withStats: boolean, nameOnly: boolean, fileOnly: boolean, readable: boolean, search: string|RegExp  }
```
> The return type depends on the opts, but the typings will guide if you are using an editor that supports it.
