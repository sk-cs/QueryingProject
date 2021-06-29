import { InsightError } from "../controller/IInsightFacade";
import {QueryReturnType} from "./QueryPerform";

interface GroupReturnType { [key: string]: string | number | any[]; }
const applyToken = { MAX: "MAX", MIN: "MIN", AVG: "AVG", COUNT: "COUNT"};
const orderDirection = {UP: "UP", DOWN: "DOWN"};

// handle transformations return grouped and applied result dataset
export const handleTransformations = (query: any, dataset: any[]): any[] => {

    let result: object[] = [];
    try {
        result = handleGroup(query.GROUP, dataset);
    } catch (error) {
        throw new InsightError("handleGroup has error");
    }

    try {
        // alter result
        handleApply(query.APPLY, result);
    } catch (error) {
        throw error;
    }

    return result;

};

// create the list of object which if form of GroupReturnType
// for example if query (which must be at least length 1) is ["courses_dept", "courses_year"], result will be list of
// {
//   "courses_dept": "apbi",
//   "courses_year": 1900,
//   "data": [... list of data (object type) ...]
// }
const handleGroup = (query: string[], dataset: any[]): any[] => {
    let queryCopy = [...query];
    let targetKey = queryCopy.shift();
    let groups: any[][] = [];
    let keyValues: any[] = [];
    let [id, field] = targetKey.split("_", 2);
    // collect all distinct group key values (such as if target key is courses_pass, find all distinct pass values)
    for (let data of dataset) {
        if (!keyValues.includes(data[field])) {
            keyValues.push(data[field]);
            let group: any[] = [data];
            groups.push(group);
        } else {
            let index = keyValues.indexOf(data[field]);
            groups[index].push(data);
        }
    }
    // for each distinct group key values create group of data and save in object form such as
    // {
    //   "courses_dept": "apbi",
    //   "data": [... list of data (object type) ...]
    // }
    let groupObjects: GroupReturnType[] = [];
    for (let i in keyValues) {
        let groupObject: GroupReturnType = {};
        groupObject[field] = keyValues[i];
        groupObject["data"] = groups[i];
        groupObjects.push(groupObject);
    }
    // if there is not more group key, stop (base case)
    if (queryCopy.length === 0) {
        return groupObjects;
    }
    // if there is more group key, divide grouped dataset into smaller group recursively
    let resultGroupObjects: any[] = [];
    for (let groupObject of groupObjects) {
        if (Array.isArray(groupObject.data) && groupObject.data.length !== 0) {
            let groupedGroupObjects = handleGroup(queryCopy, groupObject.data);
            delete groupObject["data"];
            for (let object of groupedGroupObjects) {
                let newObject = {...groupObject, ...object};
                resultGroupObjects.push(newObject);
            }
        }
    }
    return resultGroupObjects;
};

// the parameter groupedDataset is grouped data set that is return type of handleGroup
// groupDataset is altered
const handleApply = (query: any, groupedDataset: any[]) => {
    // for each grouped data, apply apply query and save apply query value
    // for example if the applykey is count and APPLYTOKEN is COUNT,
    // {
    //   "courses_dept": "apbi",
    //   "count": 30,
    //   "data": [... list of data (object type) ...]
    // }
    try {
        for (let data of groupedDataset) {
            for (let applyRule of query) {
                let applyKey = Object.keys(applyRule);
                let applyTokenAndKey = Object.values(applyRule);
                for (let i in applyKey) {
                    data[applyKey[i]] = handleApplyToken(applyTokenAndKey[i], data["data"]);
                }
            }
        }
    } catch (error) {
        throw error;
    }
    // delete group data since it is not needed anymore
    for (let data of groupedDataset) {
        delete data["data"];
    }
};

// check the APPLYTOKEN and call ideal helper handle function
// return the applied value of grouped data which can be number or string
const handleApplyToken = (query: any, groupedData: any[]): any => {
    try {
        if (query.MAX !== undefined) {
            return handleMaxAndMin(query.MAX, groupedData, applyToken.MAX);
        } else if (query.MIN !== undefined) {
            return handleMaxAndMin(query.MIN, groupedData, applyToken.MIN);
        } else if (query.AVG !== undefined) {
            return Math.round((handleSum(query.AVG, groupedData) / groupedData.length) * 100) / 100;
        } else if (query.COUNT !== undefined) {
            return handleCount(query.COUNT, groupedData);
        } else if (query.SUM !== undefined) {
            return handleSum(query.SUM, groupedData);
        } else { // invalid apply token
            throw new InsightError("APPLY Token has problem");
        }
    } catch (error) {
        throw error;
    }
};

const handleCount = (query: any, groupedData: any[]): number => {
    let uniqueValues: any = [];
    let [id, field] = query.split("_", 2);
    for (let data of groupedData) {
        if (!uniqueValues.includes(data[field])) {
            uniqueValues.push(data[field]);
        }
    }
    return uniqueValues.length;
};

const handleMaxAndMin = (query: any, groupedData: any[], type: string): number => {
    let resultVal = null;
    let [id, field] = query.split("_", 2);
    if (type === applyToken.MIN) {
        for (let data of groupedData) {
            if (resultVal === null || data[field] < resultVal) {
                resultVal = data[field];
            }
        }
    } else if (type === applyToken.MAX) {
        for (let data of groupedData) {
            if (resultVal === null || data[field] > resultVal) {
                resultVal = data[field];
            }
        }
    }
    return resultVal;
};

const handleSum = (query: any, groupedData: any[]): number => {
    let resultVal = 0;
    let [id, field] = query.split("_", 2);
    for (let data of groupedData) {
        resultVal = resultVal + data[field];
    }
    return resultVal;
};

// handle Options
// return result dataset or throw error
export const handleOptions = (query: any, dataset: any[]): any[] => {
    let result: any[] = [];
    for (let data of dataset) {
        try {
            result.push(handleColumns(query.COLUMNS, data));
        } catch (error) {
            throw error;
        }
    }
    if (query.ORDER !== undefined) {
        try {
            if (typeof query.ORDER === "object") {
                handleOrderWithObject(query.ORDER.dir, query.ORDER.keys, result);
            } else {
                handleOrder(query.ORDER, result);
            }
        } catch (error) {
            throw error;
        }
    }
    return result;
};

// handle Columns
// if courseSection belong the query return true and object containing only query specified values
// else return false and null
const handleColumns = (query: any, data: any): any => {
    let object: QueryReturnType = {};
    // get key and extract that data from courseSection to separately store in an object
    for (let val of Object.values(query)) {
        let key = "";
        if (val.toString().includes("_")) {
            let [id, field] = val.toString().split("_", 2);
            key = field;
        } else {
            key = val.toString();
        }
        object[val.toString()] = data[key];
    }
    if (Object.keys(object).length === 0) {
        throw new InsightError("error in handleColumns()");
    }
    return object;
};

// handle Order
// return true if courseSection belong the query else return false
const handleOrder = (query: any, dataset: any[]) => {

    dataset.sort((a, b) => {
        if (a[query] < b[query]) {
            return -1;
        } else if (a[query] > b[query]) {
            return 1;
        }
        return 0;
    });
};

const handleOrderWithObject = (dir: any, keys: any, dataset: any[]) => {
    if (keys.length === 0) {
        return;
    }
    let keysCopy = [...keys];
    let targetKey = keysCopy.shift();
    let tieValues: any = [];
    dataset.sort((a, b) => {
        if (a[targetKey] < b[targetKey]) {
            if (dir === orderDirection.UP) {
                return -1;
            }
            return 1;
        } else if (a[targetKey] > b[targetKey]) {
            if (dir === orderDirection.UP) {
                return 1;
            }
            return -1;
        } else {
            if (!tieValues.includes(a[targetKey])) {
                tieValues.push(a[targetKey]);
            }
            return 0;
        }
    });
    let tieIndexList: number[][] = new Array(tieValues.length).fill([]).map(() => new Array());
    let tieDataList: any[][] = new Array(tieValues.length).fill([]).map(() => new Array());
    for (let i in dataset) {
        if (tieValues.includes(dataset[i][targetKey])) {
            let index = tieValues.indexOf(dataset[i][targetKey]);
            tieIndexList[index].push(Number(i));
            tieDataList[index].push({...dataset[i]});
        }
    }
    for (let i in tieIndexList) {
        handleOrderWithObject(dir, keysCopy, tieDataList[Number(i)]);
        for (let j in tieIndexList[Number(i)]) {
            dataset[tieIndexList[Number(i)][j]] = tieDataList[Number(i)][j];
        }
    }
};

