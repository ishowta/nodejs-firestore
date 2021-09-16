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
import { Write } from './write';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as helpers from '../helpers';


/**
 * The request for Firestore.BatchWrite.
 */
export class BatchWriteRequest {
    /**
     * Labels associated with this batch write.
     */
    labels?: { [key: string]: string; };
    /**
     * The writes to apply. Method does not apply writes atomically and does not guarantee ordering. Each write succeeds or fails independently. You cannot write to the same document more than once per request.
     */
    writes?: Array<Write>;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(json: any) {
        if (json.labels !== undefined) {
            this.labels = json.labels;
        }
        if (json.writes !== undefined) {
            this.writes = [];
            json.writes.forEach((element: Write) => {
                this.writes?.push(new Write(element));
            });
        }
  }
}
