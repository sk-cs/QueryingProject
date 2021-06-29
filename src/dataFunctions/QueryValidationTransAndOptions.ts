import {InsightError} from "../controller/IInsightFacade";
import {validateKey, keyFieldKind} from "./QueryValidationBody";

const orderDirection = ["UP", "DOWN"];
const numericalApplyToken = ["MAX", "MIN", "AVG", "SUM"];
const numericalAndStringApplyToken = ["COUNT"];
let applyKeys: string[] = [];
let groupKeys: string[] = [];
let transformationExist = false;

// This needs to take a query and verify if the GROUP and APPLY keys exist
export const validateTransformations = (query: any) => {
    // reset the applyKeys and groupKeys
    applyKeys = [];
    groupKeys = [];
    // CHECKS if the keys which are in transformations are either GROUP or APPLY
    for (let key of Object.keys(query)) {
        if (key !== "GROUP" && key !== "APPLY") {
            throw new InsightError("TRANSFORMATIONS shouldn't have other object then GROUP and APPLY");
        }
    }
    if (query.GROUP !== undefined && query.APPLY !== undefined) {
        try {
            validateGroup(query.GROUP);
            validateApply(query.APPLY);
        } catch (error) {
            throw error;
        }
    } else {
        throw new InsightError("GROUP or APPLY are undefined in TRANSFORMATIONS");
    }
};

const validateApply = (query: any) => {
    // Iterate over list of APPLYRULE to check validation
    for (let applyRule of Object.values(query)) {
        if (Object.keys(applyRule).length !== 1) {
            throw new InsightError("Each APPLYRULE should have only one APPLYKEY");
        }
        // Check to ensure that APPLYKEY does not have underscore
        for (let key of Object.keys(applyRule)) {
            if (key.includes("_")) {
                throw new InsightError("APPLYKEY contains underscore");
            }
            if (applyKeys.includes(key)) {
                throw new InsightError("APPLYKEY shouldn't be reused");
            }
            applyKeys.push(key);
        }
        if (Object.values(applyRule).length !== 1) {
            throw new InsightError("Each APPLYRULE should have only one APPLYTOKEN and target key pair");
        }
        // READ value in APPLYRULE Object and call to validate APPLYTOKEN and key
        for (let applyRuleValue of Object.values(applyRule)) {
            try {
                if (applyRuleValue !== undefined) {
                    validateApplyTokenAndKey(applyRuleValue);
                } else {
                    throw new InsightError("APPLYRULE value must exist");
                }
            } catch (error) {
                throw error;
            }
        }
    }
};

const validateApplyTokenAndKey = (query: any) => {

    // CHECK to make sure that the value of APPLYRULE is formatted properly so that it can be read
    if (Object.keys(query).length !== 1) {
        throw new InsightError("APPLYRULE body should have only one key");
    }
    // check to ensure that KEY provided is a string
    let keys = Object.keys(query);
    let values: string[] = Object.values(query);
    if (keys.length !== 1 || values.length !== 1) {
        throw new InsightError("APPLYRULE must have target key");
    }
    for (let i in keys) {
        if (typeof values[i] !== "string") {
            throw new InsightError("APPLYRULE target key must be string type");
        }
        if (!numericalApplyToken.includes(keys[i]) && !numericalAndStringApplyToken.includes(keys[i])) {
            throw new InsightError("APPLYTOKEN is not valid");
        }
        try {
            if (numericalApplyToken.includes(keys[i])) {
                validateKey(values[i], keyFieldKind.mfield);
            } else {
                validateKey(values[i]);
            }
        } catch (error) {
        throw error;
        }
    }

};

const validateGroup = (query: any) => {
    // CHECK to make sure GROUP is Array
    if (Object.values(query).length < 1) {
        throw new InsightError("GROUP should have at least one key");
    }
    // Iterate over query to ensure that keys are valid
    for (let val of Object.values(query)) {
        try {
            if (typeof val === "string") {
                validateKey(val);
                groupKeys.push(val);
            } else {
                throw new InsightError("GROUP target keys are not string");
            }
        } catch (error) {
            throw error;
        }
    }
};

// check the validation of the Options object
// If it is valid return true, if it is invalid throw error
export const validateOptions = (query: any, isTransformation: boolean) => {
    transformationExist = isTransformation;
    // check if keys are valid. Should be one of COLUMNS or Order
    for (let key of Object.keys(query)) {
        if (key !== "COLUMNS" && key !== "ORDER") {
            throw new InsightError("WHERE should have COLUMNS, optionally ORDER and not else");
        }
    }
    // check if Options object have Columns and if there is call the validation function for Columns
    // else return error
    if (query.COLUMNS !== undefined) {
        try {
            validateColumns(query.COLUMNS);
            if (query.ORDER !== undefined) {
                validateOrder(query);
            }
        } catch (error) {
            throw error;
        }
    } else {
        throw new InsightError("OPTIONS must have COLUMNS");
    }
};

// Validate columns can stay the same, but now is to have a SORT function.
// check the validation of the Column object
// If it is valid return true, if it is invalid throw error
const validateColumns = (query: any) => {
    // check if the Columns object has at least one key
    if (Object.values(query).length < 1) {
        throw new InsightError("COLUMNS should have at least one key");
    }
    // check the validation of key
    for (let val of Object.values(query)) {
        if (typeof val !== "string") {
            throw new InsightError("COLUMNS has not string key");
        }
        try {
            // Transformation object didn't exist
            if (!transformationExist) {
                validateKey(val);
            } else if (!applyKeys.includes(val) && !groupKeys.includes(val)) {
                throw new InsightError("COLUMNS keys are invalid");
            }
        } catch (error) {
            throw error;
        }
    }
};

// check the validation of the Order where parameter is OPTIONS value
// different validation for object type of Order or string type Order
// if it is invalid throw error
const validateOrder = (query: any) => {
    // check if the Order has length of one
    if (Array.isArray(query.ORDER)) {
        throw new InsightError("ORDER should have exactly one key or object");
    }
    // check the value type of Order
    if (typeof query.ORDER === "string") {
        // check if the order keys are in columns keys
        if (!Object.values(query.COLUMNS).includes(query.ORDER.toString())) {
            throw new InsightError("ORDER key should be in COLUMNS");
        }
    } else if (typeof query.ORDER === "object") {
        for (let key of Object.keys(query.ORDER)) {
            if (key !== "dir" && key !== "keys") {
                throw new InsightError("Order should only have dir or keys");
            }
        }
        if (query.ORDER.dir !== undefined) {
            validateOrderDir(query.ORDER.dir);
        } else {
            throw new InsightError("Order object must have dir");
        }
        if (query.ORDER.keys !== undefined) {
            validateOrderKeys(query);
        } else {
            throw new InsightError("Order object must have keys");
        }
    } else {
        throw new InsightError("Order value type is invalid should be object or string");
    }
};

// validate the ORDER DIRECTION where the parameter is ORDER.dir value
// throw error if it is invalid
const validateOrderDir = (query: any) => {
    if (Array.isArray(query)) {
        throw new InsightError("ORDER dir value should not be array");
    }
    if (!orderDirection.includes(query)) {
        throw new InsightError("ORDER DIRECTION should be one of UP or DOWN");
    }
};

// validate the ORDER keys where the parameter is OPTIONS value which checked that query.ORDER.keys exists
// throw error if it is invalid
const validateOrderKeys = (query: any) => {
    if (!Array.isArray(query.ORDER.keys) || query.ORDER.keys.length === 0) {
        throw new InsightError("ORDER keys value should be array type");
    }
    // check if the order keys are in columns keys
    for (let val of Object.values(query.ORDER.keys)) {
        if (!Object.values(query.COLUMNS).includes(val)) {
            throw new InsightError("ORDER key should be in COLUMNS");
        }
    }
};
