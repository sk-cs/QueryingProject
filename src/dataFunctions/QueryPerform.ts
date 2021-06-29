import {InsightError, ResultTooLargeError} from "../controller/IInsightFacade";
import {validateQuery} from "./QueryValidationBody";
import InsightFacade from "../controller/InsightFacade";
import {handleTransformations, handleOptions} from "./QueryPerformTransAndOptions";

const McomparisonType = {LT: "LT", GT: "GT", EQ: "EQ"};
let currentId = "";
let searchingDataset: any[] = [];
export interface QueryReturnType { [key: string]: string | number; }

// check the validation for query contents, WHERE and OPTIONS
// return [true, result of query, "query successful"] if it was successful
// else return [false, errorType, error description]
export const handleQueryCourse = (query: any, accessDatasets: InsightFacade): any[] => {
    // do the validation check
    try {
        currentId = validateQuery(query, accessDatasets);
    } catch (error) {
        throw error;
    }
    // Store the current datasets that we performing query on
    searchingDataset = accessDatasets.getDatasetsOfId(currentId);
    if (searchingDataset.length === 0) {
        throw new InsightError("dataset is empty");
    }
    // initiate variables
    let resultOfQuery: any = null;
    // finished validation so start query by handling Where object
    // check if the where clause is empty, in that case need to return all the objects in searchingDataset
    let transformationExist = false;
    if (query.TRANSFORMATIONS !== undefined) {
        transformationExist = true;
    }
    if (Object.values(query.WHERE).length === 0) {
        // check if the searchingDataset length is bigger than 5000
        if (searchingDataset.length > 5000) {
            throw new ResultTooLargeError("result is too large");
        }
        // else the searchingDataset is small enough that can send all the result so move on to Options
    } else {
        try {
            resultOfQuery = handleWhere(query.WHERE, searchingDataset, transformationExist);
        } catch (error) {
            throw error;
        }
    }

    // handle Transformation object handle Options object
    if (resultOfQuery !== null && resultOfQuery.length > 0) {
        try {
            if (transformationExist) {
                resultOfQuery = handleTransformations(query.TRANSFORMATIONS, resultOfQuery);
            }
            if (resultOfQuery.length > 5000) {
                throw new ResultTooLargeError();
            }
            resultOfQuery = handleOptions(query.OPTIONS, resultOfQuery);
        } catch (err) {
            throw err;
        }
    }

    return resultOfQuery;
};


// handle Where which call handleFilters()
// return [true, list of section object] or [false, null]
// if it is false, then the result is too large
function handleWhere (query: any, dataset: any[], TransformationExist: boolean): any[] {
    let result: any[] = [];
    for (let section of dataset) {
        if (!TransformationExist && result.length > 5000) {
            throw new ResultTooLargeError();
        }
        try {
            if (handleFilters(query, section)) {
                result.push(section);
            }
        } catch (error) {
            throw error;
        }
    }
    return result;
}

// call corresponding handler for different type of filter
// return true if courseSection belong the query else return false
const handleFilters = (query: any, courseSection: any): boolean => {
    // check which filter it is can call the handler
    try {
        if (query.NOT !== undefined) { // NEGATION - NOT
            return !handleFilters(query.NOT, courseSection);
        } else if (query.IS !== undefined) { // SCOMPARISON - IS
            return handleScomparisonIS(query.IS, courseSection);
        } else if (query.LT !== undefined) { // MCOMPARISON - LT
            return handleMcomparison(query.LT, courseSection, McomparisonType.LT);
        } else if (query.GT !== undefined) { // MCOMPARISON - GT
            return handleMcomparison(query.GT, courseSection, McomparisonType.GT);
        } else if (query.EQ !== undefined) { // MCOMPARISON - EQ
            return handleMcomparison(query.EQ, courseSection, McomparisonType.EQ);
        } else if (query.AND !== undefined) { // LOGICCOMPARISON - AND
            return handleLogicComparisonAND(query.AND, courseSection);
        } else if (query.OR !== undefined) { // LOGICCOMPARISON - OR
            return handleLogicComparisonOR(query.OR, courseSection);
        } else { // invalid filter
            throw new InsightError();
        }
    } catch (error) {
        throw error;
    }
};

// check if the courseSection match the query for IS
// return true if courseSection belong the query else return false
const handleScomparisonIS = (query: any, courseSection: any): boolean => {
    for (let key of Object.keys(query)) {
        // get the sfield value that trying to compare
        let [id, field] = key.split("_", 2);
        let courseSectionSval: string = courseSection[field];

        // take out the first char and check if it is *
        let searchingVal = query[key];
        let temp = searchingVal.slice(0, 1);
        if (temp === "*") { // if the first char is *, take it out
            searchingVal = searchingVal.slice(1);
        }
        // take out the last char and check if it is *
        temp = searchingVal.slice(-1);
        if (temp === "*") { // if the last char is *, take it out
            searchingVal = searchingVal.slice(0, -1);
        }
        // check if the searching value match with the courseSectionSval
        if (courseSectionSval.includes(searchingVal)) {
            return true;
        }
    }
    return false;
};

// check if the courseSection match the query for AND
// return true if courseSection belong the query else return false
const handleLogicComparisonAND = (query: any, courseSection: any): boolean => {
    for (let val of Object.values(query)) {
        try {
            if (!handleFilters(val, courseSection)) {
                return false;
            }
        } catch (error) {
            throw error;
        }
    }
    return true;
};

// check if the courseSection match the query for OR
// return true if courseSection belong the query else return false
const handleLogicComparisonOR = (query: any, courseSection: any): boolean => {
    for (let val of Object.values(query)) {
        try {
            if (handleFilters(val, courseSection)) {
                return true;
            }
        } catch (error) {
            throw error;
        }
    }
    return false;
};

// check if the courseSection match the query for LT
// type parameter must be one of McomparisonType
// return true if courseSection belong the query else return false
const handleMcomparison = (query: any, courseSection: any, type: string): boolean => {
    for (let key of Object.keys(query)) {
        // get the mfield value that trying to compare
        let [id, field] = key.split("_", 2);
        let courseSectionMval: number = courseSection[field];

        let searchingVal = query[key];
        // check if the searching value match with the courseSectionMval
        if (type === McomparisonType.EQ) {
            if (courseSectionMval === searchingVal) {
                return true;
            }
        } else if (type === McomparisonType.LT) {
            if (courseSectionMval < searchingVal) {
                return true;
            }
        } else if (type === McomparisonType.GT) {
            if (courseSectionMval > searchingVal) {
                return true;
            }
        }
    }
    return false;
};

