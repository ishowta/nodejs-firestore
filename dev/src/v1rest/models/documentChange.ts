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
import { Document } from './document';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as helpers from '../helpers';


/**
 * A Document has changed. May be the result of multiple writes, including deletes, that ultimately resulted in a new value for the Document. Multiple DocumentChange messages may be returned for the same logical change, if multiple targets are affected.
 */
export class DocumentChange {
    /**
     * The new state of the Document. If `mask` is set, contains only fields that were updated or added.
     */
    document?: Document;
    /**
     * A set of target IDs for targets that no longer match this document.
     */
    removedTargetIds?: Array<number>;
    /**
     * A set of target IDs of targets that match this document.
     */
    targetIds?: Array<number>;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(json: any) {
        if (json.document !== undefined) {
            this.document = new Document(json.document);
        }
        if (json.removedTargetIds !== undefined) {
            this.removedTargetIds = json.removedTargetIds;
        }
        if (json.targetIds !== undefined) {
            this.targetIds = json.targetIds;
        }
  }
}
