/* eslint-disable prettier/prettier */
/**
 * Cloud Firestore API
 * Accesses the NoSQL document database built for automatic scaling, high performance, and ease of application development. 
 *
 * OpenAPI spec version: v1
 * 
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { GoogleFirestoreAdminV1IndexField } from './googleFirestoreAdminV1IndexField';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as helpers from '../helpers';


/**
 * Cloud Firestore indexes enable simple and complex queries against documents in a database.
 */
export class GoogleFirestoreAdminV1Index {
    /**
     * The fields supported by this index. For composite indexes, this is always 2 or more fields. The last field entry is always for the field path `__name__`. If, on creation, `__name__` was not specified as the last field, it will be added automatically with the same direction as that of the last field defined. If the final field in a composite index is not directional, the `__name__` will be ordered ASCENDING (unless explicitly specified). For single field indexes, this will always be exactly one entry with a field path equal to the field path of the associated field.
     */
    fields?: Array<GoogleFirestoreAdminV1IndexField>;
    /**
     * Output only. A server defined name for this index. The form of this name for composite indexes will be: `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}/indexes/{composite_index_id}` For single field indexes, this field will be empty.
     */
    name?: string;
    /**
     * Indexes with a collection query scope specified allow queries against a collection that is the child of a specific document, specified at query time, and that has the same collection id. Indexes with a collection group query scope specified allow queries against all collections descended from a specific document, specified at query time, and that have the same collection id as this index.
     */
    queryScope?: GoogleFirestoreAdminV1Index.QueryScopeEnum;
    /**
     * Output only. The serving state of the index.
     */
    state?: GoogleFirestoreAdminV1Index.StateEnum;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(json: any) {
        if (json.fields !== undefined) {
            this.fields = [];
            json.fields.forEach((element: GoogleFirestoreAdminV1IndexField) => {
                this.fields?.push(new GoogleFirestoreAdminV1IndexField(element));
            });
        }
        if (json.name !== undefined) {
            this.name = json.name; //[Data format: ]
        }
        if (json.queryScope !== undefined) {
            this.queryScope = json.queryScope; //[Data format: ]
        }
        if (json.state !== undefined) {
            this.state = json.state; //[Data format: ]
        }
  }
}
export namespace GoogleFirestoreAdminV1Index {
    export type QueryScopeEnum = 'QUERY_SCOPE_UNSPECIFIED' | 'COLLECTION' | 'COLLECTION_GROUP';
    export const QueryScopeEnum = {
        QUERYSCOPEUNSPECIFIED: 'QUERY_SCOPE_UNSPECIFIED' as QueryScopeEnum,
        COLLECTION: 'COLLECTION' as QueryScopeEnum,
        COLLECTIONGROUP: 'COLLECTION_GROUP' as QueryScopeEnum
    }
    export type StateEnum = 'STATE_UNSPECIFIED' | 'CREATING' | 'READY' | 'NEEDS_REPAIR';
    export const StateEnum = {
        STATEUNSPECIFIED: 'STATE_UNSPECIFIED' as StateEnum,
        CREATING: 'CREATING' as StateEnum,
        READY: 'READY' as StateEnum,
        NEEDSREPAIR: 'NEEDS_REPAIR' as StateEnum
    }
}
