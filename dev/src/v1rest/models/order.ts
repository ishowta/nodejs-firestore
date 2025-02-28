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
import { FieldReference } from './fieldReference';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as helpers from '../helpers';


/**
 * An order on a field.
 */
export class Order {
    /**
     * The direction to order by. Defaults to `ASCENDING`.
     */
    direction?: Order.DirectionEnum;
    /**
     * The field to order by.
     */
    field?: FieldReference;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(json: any) {
        if (json.direction !== undefined) {
            this.direction = json.direction; //[Data format: ]
        }
        if (json.field !== undefined) {
            this.field = new FieldReference(json.field);
        }
  }
}
export namespace Order {
    export type DirectionEnum = 'DIRECTION_UNSPECIFIED' | 'ASCENDING' | 'DESCENDING';
    export const DirectionEnum = {
        DIRECTIONUNSPECIFIED: 'DIRECTION_UNSPECIFIED' as DirectionEnum,
        ASCENDING: 'ASCENDING' as DirectionEnum,
        DESCENDING: 'DESCENDING' as DirectionEnum
    }
}
