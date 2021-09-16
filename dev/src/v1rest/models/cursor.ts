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
import { Value } from './value';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as helpers from '../helpers';


/**
 * A position in a query result set.
 */
export class Cursor {
    /**
     * If the position is just before or just after the given values, relative to the sort order defined by the query.
     */
    before?: boolean;
    /**
     * The values that represent a position, in the order they appear in the order by clause of a query. Can contain fewer values than specified in the order by clause.
     */
    values?: Array<Value>;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(json: any) {
        if (json.before !== undefined) {
            this.before = json.before; 
        }
        if (json.values !== undefined) {
            this.values = [];
            json.values.forEach((element: Value) => {
                this.values?.push(new Value(element));
            });
        }
  }
}
