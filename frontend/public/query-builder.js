/**
 * Builds a query object using the current document object model (DOM).
 * Must use the browser's global document object {@link https://developer.mozilla.org/en-US/docs/Web/API/Document}
 * to read DOM information.
 *
 * @returns query object adhering to the query EBNF
 */
const WHERE = "WHERE";
const OR = "OR";
const AND = "AND";
const NOT = "NOT";
const TRANSFORMATIONS = "TRANSFORMATIONS";
const GROUP = "GROUP";
const APPLY = "APPLY";
const OPTIONS = "OPTIONS";
const COLUMNS = "COLUMNS";
const ORDER = "ORDER";
const numericalKey = ["courses_avg", "courses_pass", "courses_fail", "courses_year", "courses_audit","rooms_lat", "rooms_lon", "rooms_seats"];
const courses = ["avg", "pass", "fail", "audit", "year", "dept", "id", "instructor", "title", "uuid"];
const rooms = ["lat", "lon", "seats","fullname", "shortname", "number", "name", "address", "type", "furniture", "href"];
let typeOfDataset = "";

CampusExplorer.buildQuery = () => {
    let query = {};
    let conditionVar = null;

    const activeTab = "tab-panel active";
    let coursesTab = document.getElementById("tab-courses").getAttribute("class");
    let tab;
    if (coursesTab == activeTab) {
        typeOfDataset = "courses"
        tab = document.getElementById("tab-courses");
    } else {
        typeOfDataset = "rooms";
        tab = document.getElementById("tab-rooms");
    }

    query[WHERE] = getWhereCondition(tab);
    query[OPTIONS] = getOptions(tab);

    let resultOfTransformationGet = getTransformations(tab);
    if (resultOfTransformationGet !== undefined) {
        query[TRANSFORMATIONS] = resultOfTransformationGet;
    }

    return query;
};

function getOrderDir(tab) {

    let isDirectionChecked = tab.getElementsByClassName("control descending")[0].children[0].getAttribute("checked")
    if (isDirectionChecked === "checked") {
        return "DOWN";
    } else {
        return "UP";
    }
}

function getOptions(tab) {
    let optionsObject = {};
    optionsObject[COLUMNS] = getColumns(tab);
    let dir = getOrderDir(tab);
    let keys = getKeys(tab);

    if (keys.length > 0) {
        let orderObject = {};
        orderObject["dir"] = dir;
        orderObject["keys"] = keys;
        optionsObject[ORDER] = orderObject;
    }

    return optionsObject;
}

function checkedWhereCondition() {
    let all = document.getElementById(typeOfDataset+"-conditiontype-all").checked;
    let any = document.getElementById(typeOfDataset + "-conditiontype-any").checked;
    let none = document.getElementById(typeOfDataset + "-conditiontype-none").checked;
    if (all) {
        return AND;
    } else if (any) {
        return OR;
    } else if (none) {
        return NOT;
    }
}

function getWhereCondition(tab) {

    let conditions = tab.getElementsByClassName("control-group condition")
    let filterList = [];

    Array.from(conditions).forEach(
        (condition) => {
            let notObject = {};
            let regularObject = {};
            let notIsChecked = false;

            let notOption = condition.children[0].children[0];
            let fields = condition.children[1].children[0];
            let comparators = condition.children[2].children[0];
            let givenValue = condition.children[3].children[0].value;

            if (notOption.hasAttribute("checked")){
                notObject[NOT] = {};
                notIsChecked = true;
            }
            let chosenField = getElements(fields);
            let chosenComparator = getElements(comparators);

            let key = typeOfDataset + "_" + chosenField;

            if (numericalKey.includes(key)) {
                givenValue = Number(givenValue);
            }

            let SOrMComparisonObject = {}
            SOrMComparisonObject[key] = givenValue;
            if (notIsChecked) {
                notObject.NOT[chosenComparator] = SOrMComparisonObject;
                filterList.push(notObject);
            } else {
                regularObject[chosenComparator] = SOrMComparisonObject;
                filterList.push(regularObject);
            }
        }
    )

    let checkedWhereConditionResult = checkedWhereCondition();
    let whereObject = {};
    if (filterList.length > 1) {
        if (checkedWhereConditionResult === NOT) {
            let orObject = {};
            orObject[OR] = filterList;
            whereObject[checkedWhereConditionResult] = orObject;
        } else {
            whereObject[checkedWhereConditionResult] = filterList;
        }
    } else if (filterList.length === 1){
        whereObject = filterList[0];
    }

    return whereObject;
}

function getElements(attributes) {
    let val = null;
    Array.from(attributes).forEach(
        (option) => {
            if (option.hasAttribute("selected")) {
                val = option.getAttribute("value");
            }
        }
    )
    return val;
}

function getColumns(tab) {

    let columns = tab.getElementsByClassName("form-group columns").item(0);
    let columnKeys = columns.children[1].children;
    let columnsKeyList = [];

    Array.from(columnKeys).forEach(
        (keys) => {
            if (keys.children[0].checked) {
                if (courses.includes(keys.children[0].getAttribute("value")) ||
                    rooms.includes(keys.children[0].getAttribute("value"))){
                    columnsKeyList.push(typeOfDataset + "_" + keys.children[0].getAttribute("value"));
                } else {
                    columnsKeyList.push(keys.children[0].getAttribute("value"));
                }
            }
        })

    return columnsKeyList;
}

function getKeys(tab) {

    let order = tab.getElementsByClassName("control order fields").item(0)
    let orderKeys = order.children[0].children;
    let orderKeyList = [];
    Array.from(orderKeys).forEach(
        (key) => {
            if (key.hasAttribute("selected")) {
                if (rooms.includes(key.getAttribute("value")) || courses.includes(key.getAttribute("value"))) {
                    orderKeyList.push(typeOfDataset + "_" + key.getAttribute("value"));
                } else {
                    orderKeyList.push(key.getAttribute("value"));
                }
            }
        }
    )
    return orderKeyList;
}

function getTransformations(tab) {

    let transformationsObject = {};
    transformationsObject[GROUP] = getGroup(tab);
    transformationsObject[APPLY] = getApply(tab);

    if (transformationsObject[GROUP].length === 0 && transformationsObject[APPLY].length === 0) {
        return undefined;
    }
    return transformationsObject;
}

function getGroup(tab) {

    let group = tab.getElementsByClassName("form-group groups").item(0);
    let groupKeys = group.children[1].children;
    let groupKeyList = [];

    Array.from(groupKeys).forEach(
        (key) => {
            if (key.children[0].checked) {
                groupKeyList.push(typeOfDataset + "_" + key.children[0].getAttribute("value"));
            }
        }
        )

    return groupKeyList;
}

function getApply(tab) {

    let applyRules = tab.getElementsByClassName("transformations-container")[0].children;
    let applyRuleObjectList = [];

    Array.from(applyRules)
        .forEach( (applyRule) => {

            let object = {};

            let applyKey = applyRule.children[0].children[0].value;
            let applyToken = applyRule.children[1].children[0];
            let targetKey = applyRule.children[2].children[0];

            let chosenApplyToken = getElements(applyToken);
            let chosenTargetKey = getElements(targetKey);

            let key = typeOfDataset + "_" + chosenTargetKey;

            let applyKeyValueObject = {};
            applyKeyValueObject[chosenApplyToken] = key;
            let applyRuleObject = {};
            applyRuleObject[applyKey] = applyKeyValueObject;

            applyRuleObjectList.push(applyRuleObject);
    })

    return applyRuleObjectList;
}

