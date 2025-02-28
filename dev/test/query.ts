// Copyright 2017 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {DocumentData} from '@google-cloud/firestore';

import {describe, it, beforeEach, afterEach} from 'mocha';
import {expect, use} from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as extend from 'extend';

import {firestore, google} from '../protos/firestore_v1_proto_api';
import {
  DocumentReference,
  FieldPath,
  FieldValue,
  Firestore,
  Query,
  QueryDocumentSnapshot,
  setLogFunction,
  Timestamp,
} from '../src';
import {setTimeoutHandler} from '../src/backoff';
import {DocumentSnapshot, DocumentSnapshotBuilder} from '../src/document';
import {QualifiedResourcePath} from '../src/path';
import {
  ApiOverride,
  createInstance,
  document,
  InvalidApiUsage,
  Post,
  postConverter,
  requestEquals,
  response,
  set,
  stream,
  verifyInstance,
  writeResult,
} from './util/helpers';

import api = google.firestore.v1;
import protobuf = google.protobuf;

const PROJECT_ID = 'test-project';
const DATABASE_ROOT = `projects/${PROJECT_ID}/databases/(default)`;

// Change the argument to 'console.log' to enable debug output.
setLogFunction(null);

use(chaiAsPromised);

function snapshot(
  relativePath: string,
  data: DocumentData
): Promise<DocumentSnapshot> {
  return createInstance().then(firestore => {
    const path = QualifiedResourcePath.fromSlashSeparatedString(
      `${DATABASE_ROOT}/documents/${relativePath}`
    );
    const ref = new DocumentReference(firestore, path);
    const snapshot = new DocumentSnapshotBuilder(ref);
    snapshot.fieldsProto = firestore['_serializer']!.encodeFields(data);
    snapshot.readTime = Timestamp.fromMillis(0);
    snapshot.createTime = Timestamp.fromMillis(0);
    snapshot.updateTime = Timestamp.fromMillis(0);
    return snapshot.build();
  });
}

export function fieldFilters(
  fieldPath: string,
  op: api.StructuredQuery.FieldFilter.Operator,
  value: string | api.IValue,
  ...fieldPathOpAndValues: Array<
    string | api.StructuredQuery.FieldFilter.Operator | string | api.IValue
  >
): api.IStructuredQuery {
  const filters: api.StructuredQuery.IFilter[] = [];

  fieldPathOpAndValues = [fieldPath, op, value, ...fieldPathOpAndValues];

  for (let i = 0; i < fieldPathOpAndValues.length; i += 3) {
    fieldPath = fieldPathOpAndValues[i] as string;
    op = fieldPathOpAndValues[
      i + 1
    ] as api.StructuredQuery.FieldFilter.Operator;
    value = fieldPathOpAndValues[i + 2] as string | api.IValue;

    const filter: api.StructuredQuery.IFieldFilter = {
      field: {
        fieldPath,
      },
      op,
    };

    if (typeof value === 'string') {
      filter.value = {stringValue: value};
    } else {
      filter.value = value;
    }

    filters.push({fieldFilter: filter});
  }

  if (filters.length === 1) {
    return {
      where: {
        fieldFilter: filters[0].fieldFilter,
      },
    };
  } else {
    return {
      where: {
        compositeFilter: {
          op: 'AND',
          filters,
        },
      },
    };
  }
}

function unaryFilters(
  fieldPath: string,
  equals: 'IS_NAN' | 'IS_NULL' | 'IS_NOT_NAN' | 'IS_NOT_NULL',
  ...fieldPathsAndEquals: string[]
): api.IStructuredQuery {
  const filters: api.StructuredQuery.IFilter[] = [];

  fieldPathsAndEquals.unshift(fieldPath, equals);

  for (let i = 0; i < fieldPathsAndEquals.length; i += 2) {
    const fieldPath = fieldPathsAndEquals[i];
    const equals = fieldPathsAndEquals[i + 1];

    expect(equals).to.be.oneOf([
      'IS_NAN',
      'IS_NULL',
      'IS_NOT_NAN',
      'IS_NOT_NULL',
    ]);

    filters.push({
      unaryFilter: {
        field: {
          fieldPath,
        },
        op: equals as 'IS_NAN' | 'IS_NULL' | 'IS_NOT_NAN' | 'IS_NOT_NULL',
      },
    });
  }

  if (filters.length === 1) {
    return {
      where: {
        unaryFilter: filters[0].unaryFilter,
      },
    };
  } else {
    return {
      where: {
        compositeFilter: {
          op: 'AND',
          filters,
        },
      },
    };
  }
}

export function orderBy(
  fieldPath: string,
  direction: api.StructuredQuery.Direction,
  ...fieldPathAndOrderBys: Array<string | api.StructuredQuery.Direction>
): api.IStructuredQuery {
  const orderBy: api.StructuredQuery.IOrder[] = [];

  fieldPathAndOrderBys.unshift(fieldPath, direction);

  for (let i = 0; i < fieldPathAndOrderBys.length; i += 2) {
    const fieldPath = fieldPathAndOrderBys[i] as string;
    const direction = fieldPathAndOrderBys[
      i + 1
    ] as api.StructuredQuery.Direction;
    orderBy.push({
      field: {
        fieldPath,
      },
      direction,
    });
  }

  return {orderBy};
}

export function limit(n: number): api.IStructuredQuery {
  return {
    limit: {
      value: n,
    },
  };
}

function offset(n: number): api.IStructuredQuery {
  return {
    offset: n,
  };
}

export function allDescendants(kindless = false): api.IStructuredQuery {
  if (kindless) {
    return {from: [{allDescendants: true}]};
  }
  return {from: [{collectionId: 'collectionId', allDescendants: true}]};
}

export function select(...fields: string[]): api.IStructuredQuery {
  const select: api.StructuredQuery.IProjection = {
    fields: [],
  };

  for (const field of fields) {
    select.fields!.push({fieldPath: field});
  }

  return {select};
}

export function startAt(
  before: boolean,
  ...values: Array<string | api.IValue>
): api.IStructuredQuery {
  const cursor: api.ICursor = {
    values: [],
  };

  if (before) {
    cursor.before = true;
  }

  for (const value of values) {
    if (typeof value === 'string') {
      cursor.values!.push({
        stringValue: value,
      });
    } else {
      cursor.values!.push(value);
    }
  }

  return {startAt: cursor};
}

function endAt(
  before: boolean,
  ...values: Array<string | api.IValue>
): api.IStructuredQuery {
  const cursor: api.ICursor = {
    values: [],
  };

  if (before) {
    cursor.before = true;
  }

  for (const value of values) {
    if (typeof value === 'string') {
      cursor.values!.push({
        stringValue: value,
      });
    } else {
      cursor.values!.push(value);
    }
  }

  return {endAt: cursor};
}

/**
 * Returns the timestamp value for the provided readTimes, or the default
 * readTime value used in tests if no values are provided.
 */
export function readTime(
  seconds?: number,
  nanos?: number
): protobuf.ITimestamp {
  if (seconds === undefined && nanos === undefined) {
    return {seconds: '5', nanos: 6};
  }
  return {seconds: String(seconds), nanos: nanos};
}

export function queryEqualsWithParent(
  actual: api.IRunQueryRequest | undefined,
  parent: string,
  ...protoComponents: api.IStructuredQuery[]
): void {
  expect(actual).to.not.be.undefined;

  if (parent !== '') {
    parent = '/' + parent;
  }

  const query: api.IRunQueryRequest = {
    parent: DATABASE_ROOT + '/documents' + parent,
    structuredQuery: {},
  };

  for (const protoComponent of protoComponents) {
    extend(true, query.structuredQuery, protoComponent);
  }

  // We add the `from` selector here in order to avoid setting collectionId on
  // kindless queries.
  if (query.structuredQuery!.from === undefined) {
    query.structuredQuery!.from = [
      {
        collectionId: 'collectionId',
      },
    ];
  }

  // 'extend' removes undefined fields in the request object. The backend
  // ignores these fields, but we need to manually strip them before we compare
  // the expected and the actual request.
  actual = extend(true, {}, actual);
  expect(actual).to.deep.eq(query);
}

export function queryEquals(
  actual: api.IRunQueryRequest | undefined,
  ...protoComponents: api.IStructuredQuery[]
): void {
  queryEqualsWithParent(actual, /* parent= */ '', ...protoComponents);
}

function bundledQueryEquals(
  actual: firestore.IBundledQuery | undefined,
  limitType: firestore.BundledQuery.LimitType | undefined,
  ...protoComponents: api.IStructuredQuery[]
) {
  expect(actual).to.not.be.undefined;

  const query: firestore.IBundledQuery = {
    parent: DATABASE_ROOT + '/documents',
    structuredQuery: {
      from: [
        {
          collectionId: 'collectionId',
        },
      ],
    },
    limitType,
  };

  for (const protoComponent of protoComponents) {
    extend(true, query.structuredQuery, protoComponent);
  }

  // 'extend' removes undefined fields in the request object. The backend
  // ignores these fields, but we need to manually strip them before we compare
  // the expected and the actual request.
  actual = extend(true, {}, actual);
  expect(actual).to.deep.eq(query);
}

export function result(documentId: string): api.IRunQueryResponse {
  return {document: document(documentId), readTime: {seconds: 5, nanos: 6}};
}

describe('query interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    setTimeoutHandler(setImmediate);
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => {
    verifyInstance(firestore);
    setTimeoutHandler(setTimeout);
  });

  it('has isEqual() method', () => {
    const queryA = firestore.collection('collectionId');
    const queryB = firestore.collection('collectionId');

    const queryEquals = (equals: Query[], notEquals: Query[]) => {
      for (let i = 0; i < equals.length; ++i) {
        for (const equal of equals) {
          expect(equals[i].isEqual(equal)).to.be.true;
          expect(equal.isEqual(equals[i])).to.be.true;
        }

        for (const notEqual of notEquals) {
          expect(equals[i].isEqual(notEqual)).to.be.false;
          expect(notEqual.isEqual(equals[i])).to.be.false;
        }
      }
    };

    queryEquals(
      [queryA.where('a', '==', '1'), queryB.where('a', '==', '1')],
      [queryA.where('a', '=' as InvalidApiUsage, 1)]
    );

    queryEquals(
      [
        queryA.where('a', '==', '1').where('b', '==', 2),
        queryB.where('a', '==', '1').where('b', '==', 2),
      ],
      []
    );

    queryEquals(
      [
        queryA.orderBy('__name__'),
        queryA.orderBy('__name__', 'asc'),
        queryB.orderBy('__name__', 'ASC' as InvalidApiUsage),
        queryB.orderBy(FieldPath.documentId()),
      ],
      [queryA.orderBy('foo'), queryB.orderBy(FieldPath.documentId(), 'desc')]
    );

    queryEquals(
      [queryA.limit(0), queryB.limit(0).limit(0)],
      [queryA, queryB.limit(10)]
    );

    queryEquals(
      [queryA.offset(0), queryB.offset(0).offset(0)],
      [queryA, queryB.offset(10)]
    );

    queryEquals(
      [queryA.orderBy('foo').startAt('a'), queryB.orderBy('foo').startAt('a')],
      [
        queryA.orderBy('foo').startAfter('a'),
        queryB.orderBy('foo').endAt('a'),
        queryA.orderBy('foo').endBefore('a'),
        queryB.orderBy('foo').startAt('b'),
        queryA.orderBy('bar').startAt('a'),
      ]
    );

    queryEquals(
      [
        queryA.orderBy('foo').startAfter('a'),
        queryB.orderBy('foo').startAfter('a'),
      ],
      [
        queryA.orderBy('foo').startAfter('b'),
        queryB.orderBy('bar').startAfter('a'),
      ]
    );

    queryEquals(
      [
        queryA.orderBy('foo').endBefore('a'),
        queryB.orderBy('foo').endBefore('a'),
      ],
      [
        queryA.orderBy('foo').endBefore('b'),
        queryB.orderBy('bar').endBefore('a'),
      ]
    );

    queryEquals(
      [queryA.orderBy('foo').endAt('a'), queryB.orderBy('foo').endAt('a')],
      [queryA.orderBy('foo').endAt('b'), queryB.orderBy('bar').endAt('a')]
    );

    queryEquals(
      [
        queryA.orderBy('foo').orderBy('__name__').startAt('b', 'c'),
        queryB.orderBy('foo').orderBy('__name__').startAt('b', 'c'),
      ],
      []
    );
  });

  it('accepts all variations', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          fieldFilters('foo', 'EQUAL', 'bar'),
          orderBy('foo', 'ASCENDING'),
          limit(10)
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '==', 'bar');
      query = query.orderBy('foo');
      query = query.limit(10);
      return query.get().then(results => {
        expect(results.query).to.equal(query);
        expect(results.size).to.equal(0);
        expect(results.empty).to.be.true;
      });
    });
  });

  it('supports empty gets', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request);
        return stream({readTime: {seconds: 5, nanos: 6}});
      },
    };

    return createInstance(overrides).then(firestore => {
      const query = firestore.collection('collectionId');
      return query.get().then(results => {
        expect(results.size).to.equal(0);
        expect(results.empty).to.be.true;
        expect(results.readTime.isEqual(new Timestamp(5, 6))).to.be.true;
      });
    });
  });

  it('retries on stream failure', () => {
    let attempts = 0;
    const overrides: ApiOverride = {
      runQuery: () => {
        ++attempts;
        throw new Error('Expected error');
      },
    };

    return createInstance(overrides).then(firestore => {
      const query = firestore.collection('collectionId');
      return query
        .get()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch(() => {
          expect(attempts).to.equal(5);
        });
    });
  });

  it('supports empty streams', callback => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request);
        return stream({readTime: {seconds: 5, nanos: 6}});
      },
    };

    createInstance(overrides).then(firestore => {
      const query = firestore.collection('collectionId');
      query
        .stream()
        .on('data', () => {
          throw new Error('Unexpected document');
        })
        .on('end', () => {
          callback();
        });
    });
  });

  it('returns results', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request);
        return stream(result('first'), result('second'));
      },
    };

    return createInstance(overrides).then(firestore => {
      const query = firestore.collection('collectionId');
      return query.get().then(results => {
        expect(results.size).to.equal(2);
        expect(results.empty).to.be.false;
        expect(results.readTime.isEqual(new Timestamp(5, 6))).to.be.true;
        expect(results.docs[0].id).to.equal('first');
        expect(results.docs[1].id).to.equal('second');
        expect(results.docChanges()).to.have.length(2);

        let count = 0;

        results.forEach(doc => {
          expect(doc instanceof DocumentSnapshot).to.be.true;
          expect(doc.createTime.isEqual(new Timestamp(1, 2))).to.be.true;
          expect(doc.updateTime.isEqual(new Timestamp(3, 4))).to.be.true;
          expect(doc.readTime.isEqual(new Timestamp(5, 6))).to.be.true;
          ++count;
        });

        expect(2).to.equal(count);
      });
    });
  });

  it('handles stream exception at initialization', () => {
    const query = firestore.collection('collectionId');

    query._stream = () => {
      throw new Error('Expected error');
    };

    return query
      .get()
      .then(() => {
        throw new Error('Unexpected success in Promise');
      })
      .catch(err => {
        expect(err.message).to.equal('Expected error');
      });
  });

  it('handles stream exception during initialization', () => {
    const overrides: ApiOverride = {
      runQuery: () => {
        return stream(new Error('Expected error'));
      },
    };

    return createInstance(overrides).then(firestore => {
      return firestore
        .collection('collectionId')
        .get()
        .then(() => {
          throw new Error('Unexpected success in Promise');
        })
        .catch(err => {
          expect(err.message).to.equal('Expected error');
        });
    });
  });

  it('handles stream exception after initialization (with get())', () => {
    const responses = [
      () => stream(result('first'), new Error('Expected error')),
      () => stream(result('second')),
    ];
    const overrides: ApiOverride = {
      runQuery: () => responses.shift()!(),
    };

    return createInstance(overrides).then(firestore => {
      return firestore
        .collection('collectionId')
        .get()
        .then(snap => {
          expect(snap.size).to.equal(2);
          expect(snap.docs[0].id).to.equal('first');
          expect(snap.docs[1].id).to.equal('second');
        });
    });
  });

  it('handles stream exception after initialization (with stream())', done => {
    const responses = [
      () => stream(result('first'), new Error('Expected error')),
      () => stream(result('second')),
    ];
    const overrides: ApiOverride = {
      runQuery: () => responses.shift()!(),
    };

    createInstance(overrides).then(firestore => {
      const result = firestore.collection('collectionId').stream();

      let resultCount = 0;
      result.on('data', doc => {
        expect(doc).to.be.an.instanceOf(QueryDocumentSnapshot);
        ++resultCount;
      });
      result.on('end', () => {
        expect(resultCount).to.equal(2);
        done();
      });
    });
  });

  it('streams results', callback => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request);
        return stream(result('first'), result('second'));
      },
    };

    createInstance(overrides).then(firestore => {
      const query = firestore.collection('collectionId');
      let received = 0;

      query
        .stream()
        .on('data', doc => {
          expect(doc).to.be.an.instanceOf(DocumentSnapshot);
          ++received;
        })
        .on('end', () => {
          expect(received).to.equal(2);
          callback();
        });
    });
  });

  it('for Query.withConverter()', async () => {
    const doc = document('documentId', 'author', 'author', 'title', 'post');
    const overrides: ApiOverride = {
      commit: request => {
        const expectedRequest = set({
          document: doc,
        });
        requestEquals(request, expectedRequest);
        return response(writeResult(1));
      },
      runQuery: request => {
        queryEquals(request, fieldFilters('title', 'EQUAL', 'post'));
        return stream({document: doc, readTime: {seconds: 5, nanos: 6}});
      },
    };

    return createInstance(overrides).then(async firestore => {
      await firestore
        .collection('collectionId')
        .doc('documentId')
        .set({title: 'post', author: 'author'});
      const posts = await firestore
        .collection('collectionId')
        .where('title', '==', 'post')
        .withConverter(postConverter)
        .get();
      expect(posts.size).to.equal(1);
      expect(posts.docs[0].data().toString()).to.equal('post, by author');
    });
  });

  it('propagates withConverter() through QueryOptions', async () => {
    const doc = document('documentId', 'author', 'author', 'title', 'post');
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, fieldFilters('title', 'EQUAL', 'post'));
        return stream({document: doc, readTime: {seconds: 5, nanos: 6}});
      },
    };

    return createInstance(overrides).then(async firestore => {
      const coll = await firestore
        .collection('collectionId')
        .withConverter(postConverter);

      // Verify that the converter is carried through.
      const posts = await coll.where('title', '==', 'post').get();
      expect(posts.size).to.equal(1);
      expect(posts.docs[0].data().toString()).to.equal('post, by author');
    });
  });

  it('withConverter(null) applies the default converter', async () => {
    const doc = document('documentId', 'author', 'author', 'title', 'post');
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, fieldFilters('title', 'EQUAL', 'post'));
        return stream({document: doc, readTime: {seconds: 5, nanos: 6}});
      },
    };

    return createInstance(overrides).then(async firestore => {
      const coll = await firestore
        .collection('collectionId')
        .withConverter(postConverter)
        .withConverter(null);

      const posts = await coll.where('title', '==', 'post').get();
      expect(posts.size).to.equal(1);
      expect(posts.docs[0].data()).to.not.be.instanceOf(Post);
    });
  });
});

describe('where() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('generates proto', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, fieldFilters('foo', 'EQUAL', 'bar'));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '==', 'bar');
      return query.get();
    });
  });

  it('concatenates all accepted filters', () => {
    const arrValue: api.IValue = {
      arrayValue: {
        values: [
          {
            stringValue: 'barArray',
          },
        ],
      },
    };
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          fieldFilters(
            'fooSmaller',
            'LESS_THAN',
            'barSmaller',
            'fooSmallerOrEquals',
            'LESS_THAN_OR_EQUAL',
            'barSmallerOrEquals',
            'fooEquals',
            'EQUAL',
            'barEquals',
            'fooEqualsLong',
            'EQUAL',
            'barEqualsLong',
            'fooGreaterOrEquals',
            'GREATER_THAN_OR_EQUAL',
            'barGreaterOrEquals',
            'fooGreater',
            'GREATER_THAN',
            'barGreater',
            'fooContains',
            'ARRAY_CONTAINS',
            'barContains',
            'fooIn',
            'IN',
            arrValue,
            'fooContainsAny',
            'ARRAY_CONTAINS_ANY',
            arrValue,
            'fooNotEqual',
            'NOT_EQUAL',
            'barEqualsLong',
            'fooNotIn',
            'NOT_IN',
            arrValue
          )
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('fooSmaller', '<', 'barSmaller');
      query = query.where('fooSmallerOrEquals', '<=', 'barSmallerOrEquals');
      query = query.where('fooEquals', '=' as InvalidApiUsage, 'barEquals');
      query = query.where('fooEqualsLong', '==', 'barEqualsLong');
      query = query.where('fooGreaterOrEquals', '>=', 'barGreaterOrEquals');
      query = query.where('fooGreater', '>', 'barGreater');
      query = query.where('fooContains', 'array-contains', 'barContains');
      query = query.where('fooIn', 'in', ['barArray']);
      query = query.where('fooContainsAny', 'array-contains-any', ['barArray']);
      query = query.where('fooNotEqual', '!=', 'barEqualsLong');
      query = query.where('fooNotIn', 'not-in', ['barArray']);
      return query.get();
    });
  });

  it('accepts object', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          fieldFilters('foo', 'EQUAL', {
            mapValue: {
              fields: {
                foo: {stringValue: 'bar'},
              },
            },
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '==', {foo: 'bar'});
      return query.get();
    });
  });

  it('supports field path objects for field paths', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          fieldFilters(
            'foo.bar',
            'EQUAL',
            'foobar',
            'bar.foo',
            'EQUAL',
            'foobar'
          )
        );
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo.bar', '==', 'foobar');
      query = query.where(new FieldPath('bar', 'foo'), '==', 'foobar');
      return query.get();
    });
  });

  it('supports strings for FieldPath.documentId()', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          fieldFilters('__name__', 'EQUAL', {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/foo',
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.where(FieldPath.documentId(), '==', 'foo');
      return query.get();
    });
  });

  it('supports reference array for IN queries', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          fieldFilters('__name__', 'IN', {
            arrayValue: {
              values: [
                {
                  referenceValue: `projects/${PROJECT_ID}/databases/(default)/documents/collectionId/foo`,
                },
                {
                  referenceValue: `projects/${PROJECT_ID}/databases/(default)/documents/collectionId/bar`,
                },
              ],
            },
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      const collection = firestore.collection('collectionId');
      const query = collection.where(FieldPath.documentId(), 'in', [
        'foo',
        collection.doc('bar'),
      ]);
      return query.get();
    });
  });

  it('Fields of IN queries are not used in implicit order by', async () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          fieldFilters('foo', 'IN', {
            arrayValue: {
              values: [
                {
                  stringValue: 'bar',
                },
              ],
            },
          }),
          orderBy('__name__', 'ASCENDING'),
          startAt(true, {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc1',
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(async firestore => {
      const collection = firestore.collection('collectionId');
      const query = collection
        .where('foo', 'in', ['bar'])
        .startAt(await snapshot('collectionId/doc1', {}));
      return query.get();
    });
  });

  it('validates references for in/not-in queries', () => {
    const query = firestore.collection('collectionId');

    expect(() => {
      query.where(FieldPath.documentId(), 'in', ['foo', 42]);
    }).to.throw(
      'The corresponding value for FieldPath.documentId() must be a string or a DocumentReference, but was "42".'
    );

    expect(() => {
      query.where(FieldPath.documentId(), 'in', 42);
    }).to.throw(
      "Invalid Query. A non-empty array is required for 'in' filters."
    );

    expect(() => {
      query.where(FieldPath.documentId(), 'in', []);
    }).to.throw(
      "Invalid Query. A non-empty array is required for 'in' filters."
    );

    expect(() => {
      query.where(FieldPath.documentId(), 'not-in', ['foo', 42]);
    }).to.throw(
      'The corresponding value for FieldPath.documentId() must be a string or a DocumentReference, but was "42".'
    );

    expect(() => {
      query.where(FieldPath.documentId(), 'not-in', 42);
    }).to.throw(
      "Invalid Query. A non-empty array is required for 'not-in' filters."
    );

    expect(() => {
      query.where(FieldPath.documentId(), 'not-in', []);
    }).to.throw(
      "Invalid Query. A non-empty array is required for 'not-in' filters."
    );
  });

  it('validates query operator for FieldPath.document()', () => {
    const query = firestore.collection('collectionId');

    expect(() => {
      query.where(FieldPath.documentId(), 'array-contains', query.doc());
    }).to.throw(
      "Invalid Query. You can't perform 'array-contains' queries on FieldPath.documentId()."
    );

    expect(() => {
      query.where(FieldPath.documentId(), 'array-contains-any', query.doc());
    }).to.throw(
      "Invalid Query. You can't perform 'array-contains-any' queries on FieldPath.documentId()."
    );
  });

  it('rejects custom objects for field paths', () => {
    expect(() => {
      let query: Query = firestore.collection('collectionId');
      query = query.where({} as InvalidApiUsage, '==', 'bar');
      return query.get();
    }).to.throw(
      'Value for argument "fieldPath" is not a valid field path. Paths can only be specified as strings or via a FieldPath object.'
    );

    class FieldPath {}
    expect(() => {
      let query: Query = firestore.collection('collectionId');
      query = query.where(new FieldPath() as InvalidApiUsage, '==', 'bar');
      return query.get();
    }).to.throw(
      'Detected an object of type "FieldPath" that doesn\'t match the expected instance.'
    );
  });

  it('rejects field paths as value', () => {
    expect(() => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '==', new FieldPath('bar'));
      return query.get();
    }).to.throw(
      'Value for argument "value" is not a valid query constraint. Cannot use object of type "FieldPath" as a Firestore value.'
    );
  });

  it('rejects field delete as value', () => {
    expect(() => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '==', FieldValue.delete());
      return query.get();
    }).to.throw(
      'FieldValue.delete() must appear at the top-level and can only be used in update() or set() with {merge:true}.'
    );
  });

  it('rejects custom classes as value', () => {
    class Foo {}
    class FieldPath {}
    class FieldValue {}
    class GeoPoint {}
    class DocumentReference {}

    const query = firestore.collection('collectionId');

    expect(() => {
      query.where('foo', '==', new Foo()).get();
    }).to.throw(
      'Value for argument "value" is not a valid Firestore document. Couldn\'t serialize object of type "Foo". Firestore doesn\'t support JavaScript objects with custom prototypes (i.e. objects that were created via the "new" operator).'
    );

    expect(() => {
      query.where('foo', '==', new FieldPath()).get();
    }).to.throw(
      'Detected an object of type "FieldPath" that doesn\'t match the expected instance.'
    );

    expect(() => {
      query.where('foo', '==', new FieldValue()).get();
    }).to.throw(
      'Detected an object of type "FieldValue" that doesn\'t match the expected instance.'
    );

    expect(() => {
      query.where('foo', '==', new DocumentReference()).get();
    }).to.throw(
      'Detected an object of type "DocumentReference" that doesn\'t match the expected instance.'
    );

    expect(() => {
      query.where('foo', '==', new GeoPoint()).get();
    }).to.throw(
      'Detected an object of type "GeoPoint" that doesn\'t match the expected instance.'
    );
  });

  it('supports unary filters', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, unaryFilters('foo', 'IS_NAN', 'bar', 'IS_NULL'));

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '==', NaN);
      query = query.where('bar', '==', null);
      return query.get();
    });
  });

  it('supports unary filters', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          unaryFilters('foo', 'IS_NOT_NAN', 'bar', 'IS_NOT_NULL')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '!=', NaN);
      query = query.where('bar', '!=', null);
      return query.get();
    });
  });

  it('rejects invalid NaN filter', () => {
    expect(() => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '>', NaN);
      return query.get();
    }).to.throw(
      "Invalid query. You can only perform '==' and '!=' comparisons on NaN."
    );
  });

  it('rejects invalid Null filter', () => {
    expect(() => {
      let query: Query = firestore.collection('collectionId');
      query = query.where('foo', '>', null);
      return query.get();
    }).to.throw(
      "Invalid query. You can only perform '==' and '!=' comparisons on Null."
    );
  });

  it('verifies field path', () => {
    let query: Query = firestore.collection('collectionId');
    expect(() => {
      query = query.where('foo.', '==', 'foobar');
    }).to.throw(
      'Value for argument "fieldPath" is not a valid field path. Paths must not start or end with ".".'
    );
  });

  it('verifies operator', () => {
    let query: Query = firestore.collection('collectionId');
    expect(() => {
      query = query.where('foo', '@' as InvalidApiUsage, 'foobar');
    }).to.throw(
      'Value for argument "opStr" is invalid. Acceptable values are: <, <=, ==, !=, >, >=, array-contains, in, not-in, array-contains-any'
    );
  });
});

describe('orderBy() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('accepts empty string', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'ASCENDING'));

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo');
      return query.get();
    });
  });

  it('accepts asc', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'ASCENDING'));

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo', 'asc');
      return query.get();
    });
  });

  it('accepts desc', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'DESCENDING'));

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo', 'desc');
      return query.get();
    });
  });

  it('verifies order', () => {
    let query: Query = firestore.collection('collectionId');
    expect(() => {
      query = query.orderBy('foo', 'foo' as InvalidApiUsage);
    }).to.throw(
      'Value for argument "directionStr" is invalid. Acceptable values are: asc, desc'
    );
  });

  it('accepts field path', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo.bar', 'ASCENDING', 'bar.foo', 'ASCENDING')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo.bar');
      query = query.orderBy(new FieldPath('bar', 'foo'));
      return query.get();
    });
  });

  it('verifies field path', () => {
    let query: Query = firestore.collection('collectionId');
    expect(() => {
      query = query.orderBy('foo.');
    }).to.throw(
      'Value for argument "fieldPath" is not a valid field path. Paths must not start or end with ".".'
    );
  });

  it('rejects call after cursor', () => {
    let query: Query = firestore.collection('collectionId');

    return snapshot('collectionId/doc', {foo: 'bar'}).then(snapshot => {
      expect(() => {
        query = query.orderBy('foo').startAt('foo').orderBy('foo');
      }).to.throw(
        'Cannot specify an orderBy() constraint after calling startAt(), startAfter(), endBefore() or endAt().'
      );

      expect(() => {
        query = query
          .where('foo', '>', 'bar')
          .startAt(snapshot)
          .where('foo', '>', 'bar');
      }).to.throw(
        'Cannot specify a where() filter after calling startAt(), startAfter(), endBefore() or endAt().'
      );

      expect(() => {
        query = query.orderBy('foo').endAt('foo').orderBy('foo');
      }).to.throw(
        'Cannot specify an orderBy() constraint after calling startAt(), startAfter(), endBefore() or endAt().'
      );

      expect(() => {
        query = query
          .where('foo', '>', 'bar')
          .endAt(snapshot)
          .where('foo', '>', 'bar');
      }).to.throw(
        'Cannot specify a where() filter after calling startAt(), startAfter(), endBefore() or endAt().'
      );
    });
  });

  it('concatenates orders', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy(
            'foo',
            'ASCENDING',
            'bar',
            'DESCENDING',
            'foobar',
            'ASCENDING'
          )
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query
        .orderBy('foo', 'asc')
        .orderBy('bar', 'desc')
        .orderBy('foobar');
      return query.get();
    });
  });
});

describe('limit() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('generates proto', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, limit(10));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.limit(10);
      return query.get();
    });
  });

  it('expects number', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.limit(Infinity)).to.throw(
      'Value for argument "limit" is not a valid integer.'
    );
  });

  it('uses latest limit', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, limit(3));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.limit(1).limit(2).limit(3);
      return query.get();
    });
  });
});

describe('limitToLast() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('reverses order constraints', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'DESCENDING'), limit(10));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').limitToLast(10);
      return query.get();
    });
  });

  it('reverses cursors', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'DESCENDING'),
          startAt(true, 'end'),
          endAt(false, 'start'),
          limit(10)
        );
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query
        .orderBy('foo')
        .startAt('start')
        .endAt('end')
        .limitToLast(10);
      return query.get();
    });
  });

  it('reverses results', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'DESCENDING'), limit(2));
        return stream(result('second'), result('first'));
      },
    };

    return createInstance(overrides).then(async firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').limitToLast(2);
      const result = await query.get();
      expect(result.docs[0].id).to.equal('first');
      expect(result.docs[1].id).to.equal('second');
    });
  });

  it('expects number', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.limitToLast(Infinity)).to.throw(
      'Value for argument "limitToLast" is not a valid integer.'
    );
  });

  it('requires at least one ordering constraints', () => {
    const query = firestore.collection('collectionId');
    const result = query.limitToLast(1).get();
    return expect(result).to.eventually.be.rejectedWith(
      'limitToLast() queries require specifying at least one orderBy() clause.'
    );
  });

  it('rejects Query.stream()', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.limitToLast(1).stream()).to.throw(
      'Query results for queries that include limitToLast() constraints cannot be streamed. Use Query.get() instead.'
    );
  });

  it('uses latest limitToLast', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'DESCENDING'), limit(3));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').limitToLast(1).limitToLast(2).limitToLast(3);
      return query.get();
    });
  });

  it('converts to bundled query without order reversing', () => {
    return createInstance().then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').limitToLast(10);
      const bundledQuery = query._toBundledQuery();
      bundledQueryEquals(
        bundledQuery,
        'LAST',
        orderBy('foo', 'ASCENDING'),
        limit(10)
      );
    });
  });

  it('converts to bundled query without cursor flipping', () => {
    return createInstance().then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query
        .orderBy('foo')
        .startAt('start')
        .endAt('end')
        .limitToLast(10);
      const bundledQuery = query._toBundledQuery();
      bundledQueryEquals(
        bundledQuery,
        'LAST',
        orderBy('foo', 'ASCENDING'),
        limit(10),
        startAt(true, 'start'),
        endAt(false, 'end')
      );
    });
  });

  it('converts to bundled query without order reversing', () => {
    return createInstance().then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').limitToLast(10);
      const bundledQuery = query._toBundledQuery();
      bundledQueryEquals(
        bundledQuery,
        'LAST',
        orderBy('foo', 'ASCENDING'),
        limit(10)
      );
    });
  });

  it('converts to bundled query without cursor flipping', () => {
    return createInstance().then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query
        .orderBy('foo')
        .startAt('start')
        .endAt('end')
        .limitToLast(10);
      const bundledQuery = query._toBundledQuery();
      bundledQueryEquals(
        bundledQuery,
        'LAST',
        orderBy('foo', 'ASCENDING'),
        limit(10),
        startAt(true, 'start'),
        endAt(false, 'end')
      );
    });
  });
});

describe('offset() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('generates proto', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, offset(10));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.offset(10);
      return query.get();
    });
  });

  it('expects number', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.offset(Infinity)).to.throw(
      'Value for argument "offset" is not a valid integer.'
    );
  });

  it('uses latest offset', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, offset(3));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.offset(1).offset(2).offset(3);
      return query.get();
    });
  });
});

describe('select() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('generates proto', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, select('a', 'b.c'));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      const collection = firestore.collection('collectionId');
      const query = collection.select('a', new FieldPath('b', 'c'));

      return query.get().then(() => {
        return collection.select('a', 'b.c').get();
      });
    });
  });

  it('validates field path', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.select(1 as InvalidApiUsage)).to.throw(
      'Element at index 0 is not a valid field path. Paths can only be specified as strings or via a FieldPath object.'
    );

    expect(() => query.select('.')).to.throw(
      'Element at index 0 is not a valid field path. Paths must not start or end with ".".'
    );
  });

  it('uses latest field mask', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, select('bar'));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.select('foo').select('bar');
      return query.get();
    });
  });

  it('implicitly adds FieldPath.documentId()', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, select('__name__'));
        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.select();
      return query.get();
    });
  });
});

describe('startAt() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('accepts fields', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'),
          startAt(true, 'foo', 'bar')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').orderBy('bar').startAt('foo', 'bar');
      return query.get();
    });
  });

  it('accepts FieldPath.documentId()', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('__name__', 'ASCENDING'),
          startAt(true, {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc',
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      return snapshot('collectionId/doc', {foo: 'bar'}).then(doc => {
        const query = firestore.collection('collectionId');

        return Promise.all([
          query.orderBy(FieldPath.documentId()).startAt(doc.id).get(),
          query.orderBy(FieldPath.documentId()).startAt(doc.ref).get(),
        ]);
      });
    });
  });

  it('validates value for FieldPath.documentId()', () => {
    const query = firestore.collection('coll/doc/coll');

    expect(() => {
      query.orderBy(FieldPath.documentId()).startAt(42);
    }).to.throw(
      'The corresponding value for FieldPath.documentId() must be a string or a DocumentReference, but was "42".'
    );

    expect(() => {
      query
        .orderBy(FieldPath.documentId())
        .startAt(firestore.doc('coll/doc/other/doc'));
    }).to.throw(
      '"coll/doc/other/doc" is not part of the query result set and cannot be used as a query boundary.'
    );

    expect(() => {
      query
        .orderBy(FieldPath.documentId())
        .startAt(firestore.doc('coll/doc/coll_suffix/doc'));
    }).to.throw(
      '"coll/doc/coll_suffix/doc" is not part of the query result set and cannot be used as a query boundary.'
    );

    expect(() => {
      query.orderBy(FieldPath.documentId()).startAt(firestore.doc('coll/doc'));
    }).to.throw(
      '"coll/doc" is not part of the query result set and cannot be used as a query boundary.'
    );

    expect(() => {
      query
        .orderBy(FieldPath.documentId())
        .startAt(firestore.doc('coll/doc/coll/doc/coll/doc'));
    }).to.throw(
      'Only a direct child can be used as a query boundary. Found: "coll/doc/coll/doc/coll/doc".'
    );

    // Validate that we can't pass a reference to a collection.
    expect(() => {
      query.orderBy(FieldPath.documentId()).startAt('doc/coll');
    }).to.throw(
      'When querying a collection and ordering by FieldPath.documentId(), ' +
        'the corresponding value must be a plain document ID, but ' +
        "'doc/coll' contains a slash."
    );
  });

  it('requires at least one value', () => {
    const query = firestore.collection('coll/doc/coll');

    expect(() => {
      query.startAt();
    }).to.throw('Function "Query.startAt()" requires at least 1 argument.');
  });

  it('can specify document snapshot', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('__name__', 'ASCENDING'),
          startAt(true, {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc',
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      return snapshot('collectionId/doc', {}).then(doc => {
        const query = firestore.collection('collectionId').startAt(doc);
        return query.get();
      });
    });
  });

  it("doesn't append documentId() twice", () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('__name__', 'ASCENDING'),
          startAt(true, {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc',
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      return snapshot('collectionId/doc', {}).then(doc => {
        const query = firestore
          .collection('collectionId')
          .orderBy(FieldPath.documentId())
          .startAt(doc);
        return query.get();
      });
    });
  });

  it('appends orderBy for DocumentReference cursors', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('__name__', 'ASCENDING'),
          startAt(true, {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc',
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      return snapshot('collectionId/doc', {foo: 'bar'}).then(doc => {
        let query: Query = firestore.collection('collectionId');
        query = query.startAt(doc.ref);
        return query.get();
      });
    });
  });

  it('can extract implicit direction for document snapshot', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'ASCENDING', '__name__', 'ASCENDING'),
          startAt(true, 'bar', {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc',
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      return snapshot('collectionId/doc', {foo: 'bar'}).then(doc => {
        let query: Query = firestore.collection('collectionId').orderBy('foo');
        query = query.startAt(doc);
        return query.get();
      });
    });
  });

  it('can extract explicit direction for document snapshot', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'DESCENDING', '__name__', 'DESCENDING'),
          startAt(true, 'bar', {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc',
          })
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      return snapshot('collectionId/doc', {foo: 'bar'}).then(doc => {
        let query: Query = firestore
          .collection('collectionId')
          .orderBy('foo', 'desc');
        query = query.startAt(doc);
        return query.get();
      });
    });
  });

  it('can specify document snapshot with inequality filter', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('c', 'ASCENDING', '__name__', 'ASCENDING'),
          startAt(true, 'c', {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc',
          }),
          fieldFilters(
            'a',
            'EQUAL',
            'a',
            'b',
            'ARRAY_CONTAINS',
            'b',
            'c',
            'GREATER_THAN_OR_EQUAL',
            'c',
            'd',
            'EQUAL',
            'd'
          )
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      return snapshot('collectionId/doc', {c: 'c'}).then(doc => {
        const query = firestore
          .collection('collectionId')
          .where('a', '==', 'a')
          .where('b', 'array-contains', 'b')
          .where('c', '>=', 'c')
          .where('d', '==', 'd')
          .startAt(doc);
        return query.get();
      });
    });
  });

  it('ignores equality filter with document snapshot cursor', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('__name__', 'ASCENDING'),
          startAt(true, {
            referenceValue:
              `projects/${PROJECT_ID}/databases/(default)/` +
              'documents/collectionId/doc',
          }),
          fieldFilters('foo', 'EQUAL', 'bar')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      return snapshot('collectionId/doc', {foo: 'bar'}).then(doc => {
        const query = firestore
          .collection('collectionId')
          .where('foo', '==', 'bar')
          .startAt(doc);
        return query.get();
      });
    });
  });

  it('validates field exists in document snapshot', () => {
    const query = firestore.collection('collectionId').orderBy('foo', 'desc');

    return snapshot('collectionId/doc', {}).then(doc => {
      expect(() => query.startAt(doc)).to.throw(
        'Field "foo" is missing in the provided DocumentSnapshot. Please provide a document that contains values for all specified orderBy() and where() constraints.'
      );
    });
  });

  it('does not accept field deletes', () => {
    const query = firestore.collection('collectionId').orderBy('foo');

    expect(() => {
      query.orderBy('foo').startAt('foo', FieldValue.delete());
    }).to.throw(
      'Element at index 1 is not a valid query constraint. FieldValue.delete() must appear at the top-level and can only be used in update() or set() with {merge:true}.'
    );
  });

  it('requires order by', () => {
    let query: Query = firestore.collection('collectionId');
    query = query.orderBy('foo');

    expect(() => query.startAt('foo', 'bar')).to.throw(
      'Too many cursor values specified. The specified values must match the orderBy() constraints of the query.'
    );
  });

  it('can overspecify order by', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'),
          startAt(true, 'foo')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').orderBy('bar').startAt('foo');
      return query.get();
    });
  });

  it('validates input', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.startAt(123)).to.throw(
      'Too many cursor values specified. The specified values must match the orderBy() constraints of the query.'
    );
  });

  it('uses latest value', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'ASCENDING'), startAt(true, 'bar'));

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').startAt('foo').startAt('bar');
      return query.get();
    });
  });
});

describe('startAfter() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('accepts fields', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'),
          startAt(false, 'foo', 'bar')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').orderBy('bar').startAfter('foo', 'bar');
      return query.get();
    });
  });

  it('validates input', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.startAfter(123)).to.throw(
      'Too many cursor values specified. The specified values must match the orderBy() constraints of the query.'
    );
  });

  it('uses latest value', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'ASCENDING'),
          startAt(false, 'bar')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').startAfter('foo').startAfter('bar');
      return query.get();
    });
  });
});

describe('endAt() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('accepts fields', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'),
          endAt(false, 'foo', 'bar')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').orderBy('bar').endAt('foo', 'bar');
      return query.get();
    });
  });

  it('validates input', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.endAt(123)).to.throw(
      'Too many cursor values specified. The specified values must match the orderBy() constraints of the query.'
    );
  });

  it('uses latest value', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'ASCENDING'), endAt(false, 'bar'));

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').endAt('foo').endAt('bar');
      return query.get();
    });
  });
});

describe('endBefore() interface', () => {
  let firestore: Firestore;

  beforeEach(() => {
    return createInstance().then(firestoreInstance => {
      firestore = firestoreInstance;
    });
  });

  afterEach(() => verifyInstance(firestore));

  it('accepts fields', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'),
          endAt(true, 'foo', 'bar')
        );

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').orderBy('bar').endBefore('foo', 'bar');
      return query.get();
    });
  });

  it('validates input', () => {
    const query = firestore.collection('collectionId');
    expect(() => query.endBefore(123)).to.throw(
      'Too many cursor values specified. The specified values must match the orderBy() constraints of the query.'
    );
  });

  it('uses latest value', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, orderBy('foo', 'ASCENDING'), endAt(true, 'bar'));

        return stream();
      },
    };

    return createInstance(overrides).then(firestore => {
      let query: Query = firestore.collection('collectionId');
      query = query.orderBy('foo').endBefore('foo').endBefore('bar');
      return query.get();
    });
  });

  it('is immutable', () => {
    let expectedComponents = [limit(10)];

    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(request, ...expectedComponents);
        return stream();
      },
    };
    return createInstance(overrides).then(firestore => {
      const query = firestore.collection('collectionId').limit(10);
      const adjustedQuery = query.orderBy('foo').endBefore('foo');

      return query.get().then(() => {
        expectedComponents = [
          limit(10),
          orderBy('foo', 'ASCENDING'),
          endAt(true, 'foo'),
        ];

        return adjustedQuery.get();
      });
    });
  });
});

describe('collectionGroup queries', () => {
  it('serialize correctly', () => {
    const overrides: ApiOverride = {
      runQuery: request => {
        queryEquals(
          request,
          allDescendants(),
          fieldFilters('foo', 'EQUAL', 'bar')
        );
        return stream();
      },
    };
    return createInstance(overrides).then(firestore => {
      const query = firestore
        .collectionGroup('collectionId')
        .where('foo', '==', 'bar');
      return query.get();
    });
  });

  it('rejects slashes', () => {
    return createInstance().then(firestore => {
      expect(() => firestore.collectionGroup('foo/bar')).to.throw(
        "Invalid collectionId 'foo/bar'. Collection IDs must not contain '/'."
      );
    });
  });

  it('rejects slashes', () => {
    return createInstance().then(firestore => {
      const query = firestore.collectionGroup('collectionId');

      expect(() => {
        query.orderBy(FieldPath.documentId()).startAt('coll');
      }).to.throw(
        'When querying a collection group and ordering by ' +
          'FieldPath.documentId(), the corresponding value must result in a ' +
          "valid document path, but 'coll' is not because it contains an odd " +
          'number of segments.'
      );
    });
  });
});
