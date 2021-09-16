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
 * The streamed response for Firestore.BatchGetDocuments.
 */
export class BatchGetDocumentsResponse {
    /**
     * A document that was requested.
     */
    found?: Document;
    /**
     * A document name that was requested but does not exist. In the format: `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
     */
    missing?: string;
    /**
     * The time at which the document was read. This may be monotically increasing, in this case the previous documents in the result stream are guaranteed not to have changed between their read_time and this one.
     */
    readTime?: string;
    /**
     * The transaction that was started as part of this request. Will only be set in the first response, and only if BatchGetDocumentsRequest.new_transaction was set in the request.
     */
    transaction?: string;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(json: any) {
        if (json.found !== undefined) {
            this.found = new Document(json.found);
        }
        if (json.missing !== undefined) {
            this.missing = json.missing; //[Data format: ]
        }
        if (json.readTime !== undefined) {
            this.readTime = helpers.stringFromTimestampJson(json.readTime); //[Data format: google-datetime
        }
        if (json.transaction !== undefined) {
            this.transaction = helpers.stringFromBufferJson(json.transaction); //[Data format: byte]
        }
  }
}
