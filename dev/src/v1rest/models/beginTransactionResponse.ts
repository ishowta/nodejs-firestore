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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as helpers from '../helpers';


/**
 * The response for Firestore.BeginTransaction.
 */
export class BeginTransactionResponse {
    /**
     * The transaction that was started.
     */
    transaction?: string;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(json: any) {
        if (json.transaction !== undefined) {
            this.transaction = helpers.stringFromBufferJson(json.transaction); //[Data format: byte]
        }
  }
}
