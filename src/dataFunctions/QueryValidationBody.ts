import InsightFacade from "../controller/InsightFacade";
import {InsightDatasetKind, InsightError} from "../controller/IInsightFacade";
import {validateTransformations, validateOptions} from "./QueryValidationTransAndOptions";

const courseKeyMField = ["avg", "pass", "fail", "audit", "year"];
const roomKeyMField = ["lat", "lon", "seats"];
const courseKeySField = ["dept", "id", "instructor", "title", "uuid"];
const roomKeySField = ["fullname", "shortname", "number", "name", "address", "type", "furniture", "href"];
export const keyFieldKind = { mfield: "mfield", sfield: "sfield"};
let datasetId: string[] = [];
let currentId: string = "";
let currentInsightFacade: InsightFacade = null;
let currentDatasetKind: InsightDatasetKind = null;
// check the validation of the QUERY object
// If it is valid return currentId of the dataset, If it is invalid throw error
export const validateQuery = (query: any, insightFacade: InsightFacade): string => {
    // Store the DatasetId list and reset currentID
    currentInsightFacade = insightFacade;
    datasetId = insightFacade.getDatasetId();
    currentId = "";
    if (query === null) {
        throw new InsightError("The query is null.");
    }
    // check if the query is json (javascript object)
    if (typeof query !== "object") {
        throw new InsightError("The query is not a JSON.");
    }
    // check if the query only have two objects, WHERE and OPTIONS
    for (let key of Object.keys(query)) {
        if (key !== "WHERE" && key !== "OPTIONS" && key !== "TRANSFORMATIONS") {
            throw new InsightError("The Query has invalid object.");
        }
    }
    if (query.WHERE !== undefined) {
        // check if WHERE object is not empty
        if (Object.values(query.WHERE).length > 0) {
            try {
                validateWhere(query.WHERE);
            } catch (error) {
                throw error;
            }
        }
    } else {
        throw new InsightError("The query dose not have WHERE.");
    }
    let transformationExist = false;
    // If the Transformation Key exists, check the validation
    if (query.TRANSFORMATIONS !== undefined) {
        transformationExist = true;
        try {
            validateTransformations(query.TRANSFORMATIONS);
        } catch (error) {
            throw error;
        }
    }
    if (query.OPTIONS !== undefined) {
        try {
            validateOptions(query.OPTIONS, transformationExist);
        } catch (error) {
            throw error;
        }
    } else {
        throw new InsightError("The query does not have OPTIONS.");
    }

    return currentId;
};


// check which FILTER it is (NEGATION, SCOMPARISON, MCOMPARISON, LOGICCOMPARISON) and call its validation function
// If it is valid return true, if it is invalid throw error
const validateFilter = (query: any): boolean => {
    // check if the where object has one filter
    if (Object.values(query).length > 1) {
        throw new InsightError("Each FILTER object should only have 1 key");
    }
    try { // check which filter it is
        if (query.NOT !== undefined) { // NEGATION - NOT
            return validateNegation(query.NOT);
        } else if (query.IS !== undefined) { // SCOMPARISON - IS
            return validateScomparison(query.IS);
        } else if (query.LT !== undefined) { // MCOMPARISON - LT
            return validateMcomparison(query.LT);
        } else if (query.GT !== undefined) { // MCOMPARISON - GT
            return validateMcomparison(query.GT);
        } else if (query.EQ !== undefined) { // MCOMPARISON - EQ
            return validateMcomparison(query.EQ);
        } else if (query.AND !== undefined) { // LOGICCOMPARISON - AND
            return validateLogicComparison(query.AND);
        } else if (query.OR !== undefined) { // LOGICCOMPARISON - OR
            return validateLogicComparison(query.OR);
        } else { // invalid filter
            throw new InsightError("It is invalid FILTER");
        }
    } catch (error) {
        throw error;
    }
};
// check the validation of the WHERE object
// If it is valid return true, if it is invalid throw error
const validateWhere = (query: any): boolean => {
    // check if the where object has one filter
    if (Object.values(query).length > 1) {
        throw new InsightError("WHERE should have only 1 FILTER");
    }
    return validateFilter(query);
};
// check the validation of LOGICCOMPARISON (AND, OR)
// If it is valid return true, if it is invalid throw error
const validateLogicComparison = (query: any): boolean => {
    // check if LOGICCOMPARISON object has at least one FILTER
    if (Object.values(query).length < 1) {
        throw new InsightError("LOGIC should have at least 1 FILTER");
    }
    let result;
    for (let val of Object.values(query)) {
        try {
            result = validateFilter(val);
        } catch (error) {
            throw error;
        }
    }
    return result;
};
// check the validation of NEGATION (NOT)
// If it is valid return true, if it is invalid throw error
const validateNegation = (query: any): boolean => {
    // check if NEGATION object has exactly one FILTER
    if (Object.values(query).length !== 1) {
        throw new InsightError("NOT should have exactly one 1 FILTER");
    }
    // check the validation of one FILTER and return the result
    try {
            return validateFilter(query);
        } catch (error) {
            throw error;
  }
};
// check if one key in string has valid form input is querykey and fieldList
// fieldList is null by default which mean checking for both skey and mkey type validation
// filedList can be specified "courseKeyMField" for mkey OR "courseKeySField" for skey (defined as global variable)
// If it is valid return true, if it is invalid throw error
export const validateKey = (queryKey: string, fieldKind: string = null) => {
    let splittedKey = { id: "", field: ""};
    // check if key is in valid form "idstring_field"
    const splitted = queryKey.split("_", 2);
    if (splitted.length !== 2) {
        throw new InsightError("key is invalid");
    }
    [splittedKey.id, splittedKey.field] = splitted;
    // check if idstring is one of the id of added datasets
    // check the query is searching on only one dataset (id must match for all key)
    if (currentId === "") { // empty string means not defined yet
        if (!datasetId.includes(splittedKey.id)) {
            throw new InsightError("key idstring does not match with any id of added datasets");
        } else {
            currentId = splittedKey.id;
            currentDatasetKind = currentInsightFacade.getDatasetsKind(currentId);
        }
    } else {
        if (currentId !== splittedKey.id) {
            throw new InsightError("key idstring does not match with other key");
        }
    }
    let keyMField = [];
    let keySField = [];
    if (currentDatasetKind === InsightDatasetKind.Rooms) {
        keyMField = roomKeyMField;
        keySField = roomKeySField;
    } else if (currentDatasetKind === InsightDatasetKind.Courses) {
        keyMField = courseKeyMField;
        keySField = courseKeySField;
    } else {
        throw new InsightError("Data type of the dataset is invalid");
    }
    if (fieldKind === keyFieldKind.sfield || fieldKind === null) {
        for (let s of keySField) {
            if (splittedKey.field === s) {
                return;
            }
        }
    }
    if (fieldKind === keyFieldKind.mfield || fieldKind === null) {
        for (let s of keyMField) {
            if (splittedKey.field === s) {
                return;
            }
        }
    }
    throw new InsightError("key field is invalid");
};
// check validation of mkey and value which should be number
// If it is valid return true, if it is invalid throw error
const validateMcomparison = (query: any): boolean => {
    // check if there is only one key and value pair
    if (Object.values(query).length !== 1) {
        throw new InsightError("There should be only one key in MCOMPARISON");
    }
    // check validation of mkey
    for (let key of Object.keys(query)) {
        try {
            validateKey(key, keyFieldKind.mfield);
        } catch (error) {
            throw error;
        }
    }
    // check if the value is number
    // note that there should be only one key and value pair
    for (let val of Object.values(query)) {
        if (typeof val !== "number") {
            throw new InsightError("MCOMPARISON value should be number");
        }
    }
    return true;
};
// check validation of skey and value which should be string
// If it is valid return true, if it is invalid throw error
const validateScomparison = (query: any): boolean => {
    // check if there is only one key and value pair
    if (Object.values(query).length !== 1) {
        throw new InsightError("There should be only one key in SCOMPARISON");
    }
    // check validation of skey
    for (let key of Object.keys(query)) {
        try {
            validateKey(key, keyFieldKind.sfield);
        } catch (error) {
            throw error;
        }
}
    // check if the value is string
    // if it is a string then check if it has valid structure: [*]? inputstring [*]?
    // note that there should be only one key and value pair
    for (let val of Object.values(query)) {
        if (typeof val !== "string") {
            throw new InsightError("SCOMPARISON value should a string");
        } else if (val.length > 2) {
            // take out the first char
            let temp = val.slice(1);
            // take out the last char
            temp = temp.slice(0, -1);
            if (temp.includes("*")) {
                throw new InsightError("SCOMPARISON value, inputstring should not contain *");
            }
        }
    }
    return true;
};
