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

Checkout [hyperdrive api docs](https://docs.holepunch.to/building-blocks/hyperdrive)

Only the changed and extended apis will be documented here.

```typescript
const drive = new Hyperdrive(corestore, key?: string | Buffer, localDriveRoot?: string)
```
key should be a Hypercore public key in either hex string or buffer. 

localDriveRoot is needed in case you want export and import between your local fs system and hyperdrive. 
This defaults to current directory (ie `./`).

## Overrides 

### readdir

```typescript
drive.readdir(path: string, [opts])
```
opts
```typescript
{ 
 withStats: boolean; // defaults false
 nameOnly: boolean; // defaults false
 fileOnly: boolean; // defaults false
 readable: boolean; // defaults false
 search: string|RegExp // defaults ""
}
```
> The return type/shape depends on the opts, 
> but the typings will guide if you are using an editor that supports it.

```typescript
drive.readdir(path, { nameOnly: true });
// Promise<Array<string>>
```
```typescript
drive.readdir(path, { nameOnly: true, readable: true  });
// Readable<string>
```
```typescript
drive.readdir(path, { withStats: true, });
// Promise<Array<{ name: string; path: string; stat: Stat }>>
```
[checkout the Stat type](./#stat)

```typescript
drive.readdir(path);
// Promise<Array<{ name: string; path: string; stat: null}>>
```
With `fileOnly` option it returns only files

The `search` option searches for a file/folder name.

### list

```typescript
drive.list(path: string, [opts])
```
opts
```typescript
{ 
 withStats: boolean; // defaults false
 recursive: boolean; // defaults false
 fileOnly: boolean; // defaults false
 readable: boolean; // defaults false
 search: string|RegExp // defaults ""
}
```
> We can see that `drive.list` is almost the same as `drive.readdir` 
> with two difference `recursive` option for list and `nameOnly` option for readdir.

With `recursive` option set to `true` it recursively gets alls 
files(and folders if `fileOnly=false`) from all sub-folders

### put
It has the same api with that of hyperdrive-next but checks if a file/folder exist at a path 
Because we should not have a file and a folder at the same location. Also resolves stats.
### del
It has the same api with that of hyperdrive-next; but also resolves stats

## Additions

### exists
```ts
 exists(path: string): Promise<boolean>;
 ```
 checks if a directory or file exists at a given `path`.

### stat
```ts
stat(path: string): Promise<Stat>
```

### write
```ts
write(path: string, content: string, encoding: any): Promise<Node>
```
`encoding` defines the encoding the `content` string is in.

### rmDir
```ts
rmDir(path: string, [opts]): Promise<void>
```
opts
```ts
{
recursive: boolean // defaults false
}
```
> If `recursive` is false and directory is not empty it throws an error

### copy
```ts
copy(source: string, dest: string): Promise<Node>
```
It doesn't necessarily recreate a new blob 
but shares the `source` blob reference with the `dest`

### move
```ts
move(source: string, dest: string): Promise<Node>
```
It doesn't not recreate a new blob for `dest` and delete `source` blob.
It just _sets_ the `source` blob reference for to `dest` and _unreference_ `source` to it's blob.

### createFolderReadStream
```ts
drive.createFolderReadStream(path: string): Readable<{path: string, readable: Readable}>
```

### createFolderWriteStream
```ts
drive.createFolderWriteStream(path: string): Writable<{path: string, readable: Readable}>
```

### import
```ts 
drive.import(localPath = './', path = '/'): Promise<void>
```
It imports local file system directory into a hyperdrive directory.

### export
```ts 
drive.export(path = '/', localPath = './'): Promise<void>
```
It exports hyperdrive directory to a local file system directory.
