import type * as fs from 'fs'
import { EventEmitter } from 'events'
import Hyperbee from '../hyperbee'
import Hypercore from '../hypercore'
export = Hyperdrive;

interface Entry {
	seq: number,
	key: string,
	value: {
		executable: Boolean, // whether the blob at path is an executable
		linkname: null | string // if entry not symlink, otherwise a string to the entry this links to
		blob: { // a Hyperblob id that can be used to fetch the blob associated with this entry
			blockOffset: number,
			blockLength: number,
			byteOffset: number,
			byteLength: number
		},
		metadata: null | Record<string, any>
	}
}

declare class Hyperdrive extends EventEmitter {
	constructor(corestore: any, key: any, opts?: Record<string, string>);
	_onwait: any;
	corestore: any;
	db: Hyperbee;
	files: Hyperbee;
	blobs: any;
	supportsMetadata: boolean;
	opening: Promise<any>;
	opened: boolean;
	_openingBlobs: Promise<boolean>;
	_checkout: any;
	_batching: boolean;
	_closing: Promise<any>;
	get key(): Buffer;
	get discoveryKey(): Buffer;
	get contentKey(): Buffer;
	get core(): Hypercore;
	get version(): any;
	findingPeers(): any;
	update(): any;
	ready(): Promise<any>;
	checkout(len: any): Hyperdrive;
	batch(): Hyperdrive;
	flush(): any;
	close(): Promise<any>;
	_close(): Promise<any>;
	_openBlobsFromHeader(opts: any): Promise<boolean>;
	_open(): Promise<any>;
	getBlobs(): Promise<any>;
	get(name: any): Promise<any>;
	put(name: any, buf: any, { executable, metadata }?: {
		executable?: boolean;
		metadata?: any;
	}): Promise<any>;
	del(name: any): Promise<any>;
	symlink(name: any, dst: any, { metadata }?: {
		metadata?: any;
	}): Promise<any>;
	entry(name: string): Promise<Entry>;
	diff(length: any, folder: any, opts: any): any;
	downloadDiff(length: any, folder: any, opts: any): Promise<void>;
	downloadRange(dbRanges: any, blobRanges: any): Promise<void>;
	entries(opts: any): any;
	download(folder: string, opts: any): any;
	list(folder?: string, { recursive }?: {
		recursive?: boolean;
	}): any;
	readdir(folder?: string): any;
	mirror(out: any, opts: any): any;
	createReadStream: (path: string, options?: BufferEncoding) => fs.ReadStream;
	createWriteStream(name: string, { executable, metadata }?: {
		executable?: boolean;
		metadata?: any;
	}): fs.WriteStream;
	[Symbol.asyncIterator](): any;
}