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
import { DocumentsTarget } from './documentsTarget';
import { QueryTarget } from './queryTarget';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as helpers from '../helpers';


/**
 * A specification of a set of documents to listen to.
 */
export class Target {
    /**
     * A target specified by a set of document names.
     */
    documents?: DocumentsTarget;
    /**
     * If the target should be removed once it is current and consistent.
     */
    once?: boolean;
    /**
     * A target specified by a query.
     */
    query?: QueryTarget;
    /**
     * Start listening after a specific `read_time`. The client must know the state of matching documents at this time.
     */
    readTime?: string;
    /**
     * A resume token from a prior TargetChange for an identical target. Using a resume token with a different target is unsupported and may fail.
     */
    resumeToken?: string;
    /**
     * The target ID that identifies the target on the stream. Must be a positive number and non-zero.
     */
    targetId?: number;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(json: any) {
        if (json.documents !== undefined) {
            this.documents = new DocumentsTarget(json.documents);
        }
        if (json.once !== undefined) {
            this.once = json.once; 
        }
        if (json.query !== undefined) {
            this.query = new QueryTarget(json.query);
        }
        if (json.readTime !== undefined) {
            this.readTime = helpers.stringFromTimestampJson(json.readTime); //[Data format: google-datetime
        }
        if (json.resumeToken !== undefined) {
            this.resumeToken = helpers.stringFromBufferJson(json.resumeToken); //[Data format: byte]
        }
        if (json.targetId !== undefined) {
            this.targetId = json.targetId; 
        }
  }
}
