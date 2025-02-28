console.time('Started loading firestore_client rest');
import {GapicClient} from '../types';
import {firestore_v1} from 'googleapis/build/src/apis/firestore/v1';
import {firestore} from 'googleapis/build/src/apis/firestore';
// eslint-disable-next-line node/no-extraneous-import
import {
  AuthPlus,
  GaxiosResponse,
  Compute,
  JWT,
  UserRefreshClient,
  BaseExternalAccountClient,
  // eslint-disable-next-line node/no-extraneous-import
} from 'googleapis-common';

// eslint-disable-next-line node/no-extraneous-import
import {Impersonated} from 'google-auth-library';
import {CallOptions, ClientOptions} from 'google-gax';

import * as protos from '../../protos/firestore_v1_proto_api';
import {Duplex, Transform} from 'stream';
import {convertOptions} from './converter';
import {logger} from '../logger';
import {BeginTransactionRequest} from './models/beginTransactionRequest';
import {CommitRequest} from './models/commitRequest';
import {BatchWriteRequest} from './models/batchWriteRequest';
import {RollbackRequest} from './models/rollbackRequest';
import {BatchGetDocumentsRequest} from './models/batchGetDocumentsRequest';
import {RunQueryRequest} from './models/runQueryRequest';
import {ListCollectionIdsRequest} from './models/listCollectionIdsRequest';
import {PartitionQueryRequest} from './models/partitionQueryRequest';
console.timeEnd('Started loading firestore_client rest');
type Firestore = firestore_v1.Firestore;

export class FirestoreClient implements GapicClient {
  auth: AuthPlus;
  client: Firestore;
  settings: ClientOptions;
  authClient!:
    | Compute
    | JWT
    | UserRefreshClient
    | BaseExternalAccountClient
    | Impersonated;

  constructor(settings: ClientOptions) {
    this.settings = settings;
    this.auth = new AuthPlus({
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/datastore',
      ],
    });

    this.client = firestore({version: 'v1'});
  }

  async initializeAuthClientIfNeeded() {
    if (this.authClient) {
      return;
    }

    this.authClient = await this.auth.getClient();
    //google.options({auth: client});
  }

  async getProjectId() {
    await this.initializeAuthClientIfNeeded();
    return this.auth.getProjectId();
  }

  async beginTransaction(
    request: protos.google.firestore.v1.IBeginTransactionRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.firestore.v1.IBeginTransactionResponse,
      protos.google.firestore.v1.IBeginTransactionRequest | undefined,
      {} | undefined
    ]
  > {
    await this.initializeAuthClientIfNeeded();
    const response =
      await this.client.projects.databases.documents.beginTransaction(
        {
          database: request!.database!,
          requestBody: new BeginTransactionRequest(request),
          auth: this.authClient,
        },
        convertOptions(options)
      );
    return [
      response?.data as protos.google.firestore.v1.IBeginTransactionResponse,
      request,
      undefined,
    ]; //TODO cross check last undefined param once
  }

  async commit(
    request: protos.google.firestore.v1.ICommitRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.firestore.v1.ICommitResponse,
      protos.google.firestore.v1.ICommitRequest | undefined,
      {} | undefined
    ]
  > {
    await this.initializeAuthClientIfNeeded();
    const response = await this.client.projects.databases.documents.commit(
      {
        database: request!.database!,
        requestBody: new CommitRequest(request),
        auth: this.authClient,
      },
      convertOptions(options)
    );
    return [
      response?.data as protos.google.firestore.v1.ICommitResponse,
      request,
      undefined,
    ];
  }

  async batchWrite(
    request: protos.google.firestore.v1.IBatchWriteRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.firestore.v1.IBatchWriteResponse,
      protos.google.firestore.v1.IBatchWriteRequest | undefined,
      {} | undefined
    ]
  > {
    await this.initializeAuthClientIfNeeded();
    const response = await this.client.projects.databases.documents.batchWrite(
      {
        database: request!.database!,
        requestBody: new BatchWriteRequest(request),
        auth: this.authClient,
      },
      convertOptions(options)
    );
    return [
      response?.data as protos.google.firestore.v1.IBatchWriteResponse,
      request,
      undefined,
    ];
  }

  async rollback(
    request: protos.google.firestore.v1.IRollbackRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.protobuf.IEmpty,
      protos.google.firestore.v1.IRollbackRequest | undefined,
      {} | undefined
    ]
  > {
    await this.initializeAuthClientIfNeeded();
    const response = await this.client.projects.databases.documents.rollback(
      {
        database: request!.database!,
        requestBody: new RollbackRequest(request),
        auth: this.authClient,
      },
      convertOptions(options)
    );
    return [
      response?.data as protos.google.protobuf.IEmpty,
      request,
      undefined,
    ];
  }

  batchGetDocuments(
    request?: protos.google.firestore.v1.IBatchGetDocumentsRequest,
    options?: CallOptions
  ): Duplex {
    const duplex = new Transform();

    this.initializeAuthClientIfNeeded().then(() => {
      this.client.projects.databases.documents.batchGet(
        {
          database: request!.database!,
          requestBody: new BatchGetDocumentsRequest(request),
          auth: this.authClient,
        },
        convertOptions(options),
        (err: Error | null, res?: GaxiosResponse | null) => {
          logger(
            'Firestore(REST).batchGetDocuments',
            null,
            'Received response [Error: ',
            err,
            ' ' + 'Res: ',
            require('util').inspect(res?.data) + ']'
          );

          if (!err) {
            res?.data.forEach((element: unknown) => {
              duplex.emit('data', element);
            });

            duplex.emit('end');
          } else {
            duplex.emit('error', err);
          }
        }
      );
    });

    return duplex;
  }

  runQuery(
    request?: protos.google.firestore.v1.IRunQueryRequest,
    options?: CallOptions
  ): Duplex {
    const duplex = new Transform();

    this.initializeAuthClientIfNeeded().then(() => {
      this.client.projects.databases.documents.runQuery(
        {
          parent: request!.parent!,
          requestBody: new RunQueryRequest(request),
          auth: this.authClient,
        },
        convertOptions(options),
        (err: Error | null, res?: GaxiosResponse | null) => {
          logger(
            'Firestore(REST).runQuery',
            null,
            'Received response [Error: ',
            err,
            ' ' + 'Res: ',
            require('util').inspect(res?.data) + ']'
          );
          if (!err) {
            res?.data.forEach((element: unknown) => {
              duplex.emit('data', element);
            });

            duplex.emit('end');
          } else {
            duplex.emit('error', err);
          }
        }
      );
    });

    return duplex;
  }
  listDocuments(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    request: protos.google.firestore.v1.IListDocumentsRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options?: CallOptions
  ): Promise<[protos.google.firestore.v1.IDocument[], unknown, unknown]> {
    throw new Error('Not implemented');
  }
  async listCollectionIds(
    request: protos.google.firestore.v1.IListCollectionIdsRequest,
    options?: CallOptions
  ): Promise<[string[], unknown, unknown]> {
    await this.initializeAuthClientIfNeeded();
    const response =
      await this.client.projects.databases.documents.listCollectionIds(
        {
          parent: request!.parent!,
          requestBody: new ListCollectionIdsRequest(request),
          auth: this.authClient,
        },
        convertOptions(options)
      );
    return [response?.data as string[], undefined, undefined];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  listen(options?: CallOptions): Duplex {
    throw new Error('Not implemented');
  }
  partitionQueryStream(
    request?: protos.google.firestore.v1.IPartitionQueryRequest,
    options?: CallOptions
  ): Duplex {
    const duplex = new Transform();

    this.initializeAuthClientIfNeeded().then(() => {
      this.client.projects.databases.documents.partitionQuery(
        {
          parent: request!.parent!,
          requestBody: new PartitionQueryRequest(request),
          auth: this.authClient,
        },
        convertOptions(options),
        (err: Error | null, res?: GaxiosResponse | null) => {
          logger(
            'Firestore(REST).partitionQueryStream',
            null,
            'Received response [Error: ',
            err,
            ' ' + 'Res: ',
            require('util').inspect(res?.data) + ']'
          );
          if (!err) {
            res?.data?.partitions.forEach((element: unknown) => {
              duplex.emit('data', element);
            });

            duplex.emit('end');
          } else {
            duplex.emit('error', err);
          }
        }
      );
    });

    return duplex;
  }

  close(): Promise<void> {
    //Cleanup here
    return Promise.resolve();
  }
}
