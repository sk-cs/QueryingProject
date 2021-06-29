import {InsightError} from "../controller/IInsightFacade";
import fs = require("fs");
import JSZip = require("jszip");
import parse5 = require("parse5");
import http = require("http");
import Dataset from "../dataStructure/Dataset";
interface ObjectOfDataset { [key: string]: string | number; }
interface BuildingInfoObject { shortname: string; fullname: string; path: string; address: string; file: string;
                                lat: number; lon: number; }
const findInfoType = {building: "building", room: "room"};

const parseJsonCourse = (file: string): any[] => {
    try {
        let object = JSON.parse(file);
        let listOfSections: any[] = [];
        if (!object.hasOwnProperty("result")) {
            throw new InsightError("invalid file in the zip file");
        }
        let numOfSection = 0;
        for (let section of object.result) {
            if (section.hasOwnProperty("Professor") && section.hasOwnProperty("Audit")
                && section.hasOwnProperty("Avg") && section.hasOwnProperty("Title")
                && section.hasOwnProperty("Pass") && section.hasOwnProperty("Fail")
                && section.hasOwnProperty("Subject") && section.hasOwnProperty("Course")
                && section.hasOwnProperty("id") && section.hasOwnProperty("Year")) {
                let sectionObject: ObjectOfDataset = {};
                sectionObject["instructor"] = section.Professor;
                sectionObject["audit"] = section.Audit;
                sectionObject["avg"] = section.Avg;
                sectionObject["title"] = section.Title;
                sectionObject["pass"] = section.Pass;
                sectionObject["fail"] = section.Fail;
                sectionObject["dept"] = section.Subject;
                sectionObject["id"] = section.Course;
                sectionObject["uuid"] = section.id.toString();
                if (section.Section === "overall") {
                    sectionObject["year"] = 1900;
                } else {
                    sectionObject["year"] = parseInt(section.Year, 10);
                }
                listOfSections.push(sectionObject);
                numOfSection++;
            }
        }
        return listOfSections;
    } catch (error) {
        throw new InsightError();
    }
};

const parseJsonBuilding = (htmlFile: string): BuildingInfoObject[] => {
    try {
        let treeObject = parse5.parse(htmlFile);
        let buildingTableElement: any[] = findBuildingOrRoomTableContents(treeObject);
        let listOfBuilding: BuildingInfoObject[] = [];
        for (let building of buildingTableElement) {
            if (building !== undefined && building.nodeName === "tr") {
                let buildingInfo: BuildingInfoObject = findBuildingOrRoomInfo(building, findInfoType.building);
                listOfBuilding.push(buildingInfo);
            }
        }
        return listOfBuilding;
    } catch (error) {
        throw new InsightError(error);
    }
};

const parseListOfJsonRoom = (listOfBuildingInfo: BuildingInfoObject[]): any[] => {
    try {
        let listOfRooms: any[] = [];
        for (let buildingInfo of listOfBuildingInfo) {
            listOfRooms = listOfRooms.concat(parseJsonRoom(buildingInfo));
        }
        return listOfRooms;
    } catch (error) {
        throw error;
    }
};

const parseJsonRoom = (buildingInfo: BuildingInfoObject): any[] => {
    try {
        let listOfRooms: any[] = [];
        let buildingTreeObject: any = parse5.parse(buildingInfo.file);
        let roomTableElement: any[] = findBuildingOrRoomTableContents(buildingTreeObject);
        if (roomTableElement !== undefined) {
            for (let room of roomTableElement) {
                if (room !== undefined && room.nodeName === "tr") {
                    let roomInfo: any = findBuildingOrRoomInfo(room, findInfoType.room);
                    let roomObject: ObjectOfDataset = {};
                    roomObject["shortname"] = buildingInfo.shortname;
                    roomObject["fullname"] = buildingInfo.fullname;
                    roomObject["address"] = buildingInfo.address;
                    roomObject["number"] = roomInfo.number;
                    roomObject["name"] = buildingInfo.shortname.concat("_", roomInfo.number);
                    roomObject["lat"] = buildingInfo.lat;
                    roomObject["lon"] = buildingInfo.lon;
                    roomObject["seats"] = roomInfo.seats;
                    roomObject["type"] = roomInfo.type;
                    roomObject["furniture"] = roomInfo.furniture;
                    roomObject["href"] = roomInfo.href;
                    if (roomObject.fullname !== undefined && roomObject.shortname !== undefined &&
                        roomObject.number !== undefined && roomObject.name !== undefined &&
                        roomObject.address !== undefined && roomObject.lat !== undefined &&
                        roomObject.lon !== undefined && roomObject.seats !== undefined &&
                        roomObject.type !== undefined && roomObject.furniture !== undefined &&
                        roomObject.href !== undefined) {
                        listOfRooms.push(roomObject);
                    }
                }
            }
        }
        return listOfRooms;
    } catch (error) {
        throw new InsightError(error);
    }
};

// find the building or room table (Buildings and classrooms) in the tree object of html file
// return the table body if it is found else return undefined
const findBuildingOrRoomTableContents = (element: any): any[] => {
    if (element.nodeName === "tbody" && element.childNodes) {
        return element.childNodes;
    }

    if (element.childNodes && element.childNodes.length > 0) {
        for (let child of element.childNodes) {
            let buildingTableElement = findBuildingOrRoomTableContents(child);
            if (buildingTableElement !== undefined) {
                return buildingTableElement;
            }
        }
    }

    return undefined;
};

// Given row of building table (Buildings and classrooms) or row of room table in object form,
// and findType (one of findInfoType value) Collect and return one building's info or room's info in following form
// if building table row is given, { shortname: "", fullname: "", path: "", address: ""}
// if room table row is given, BuildingInfoObject
const findBuildingOrRoomInfo = (rowOfTableOfBuildings: any, findType: string): any => {
    let infoList: string[] = [];
    let childNodesHasNodeNamedLen = 3;
    let childNodesHasOneChildLen = 1;
    for (let buildingData of rowOfTableOfBuildings.childNodes) {
        if (buildingData.nodeName === "td" && buildingData.childNodes) {
            if (buildingData.childNodes.length === childNodesHasNodeNamedLen
                && buildingData.childNodes[1].nodeName === "a"
                && buildingData.childNodes[1].childNodes
                && buildingData.childNodes[1].childNodes.length > 0
                && buildingData.childNodes[1].childNodes[0].nodeName === "#text"
                && buildingData.childNodes[1].attrs
                && buildingData.childNodes[1].attrs.length > 0) {
                infoList.push(buildingData.childNodes[1].childNodes[0].value.trim());
                infoList.push(buildingData.childNodes[1].attrs[0].value.trim());
            } else if (buildingData.childNodes.length === childNodesHasOneChildLen
                        && buildingData.childNodes[0].nodeName === "#text") {
                infoList.push(buildingData.childNodes[0].value.trim());
            }
        }
    }
    let numOfNeedBuildingInfo = 0;
    if (findInfoType.building === findType) {
        numOfNeedBuildingInfo = 4;
        if (infoList.length > numOfNeedBuildingInfo) {
            return { shortname: infoList[0], fullname: infoList[1],  path: infoList[2], address: infoList[3],
                file: undefined, lat: undefined, lon: undefined};
        }
    } else if (findInfoType.room === findType) {
        numOfNeedBuildingInfo = 5;
        if (infoList.length > numOfNeedBuildingInfo) {
            return { number: infoList[0], href: infoList[1], seats: parseInt(infoList[2], 10),
                furniture: infoList[3], type: infoList[4] };
        }
    }
    throw new InsightError("table of building, Buildings and classrooms, has error");
};

const getPromisesForReadBuildingFilesInZip = (zip: JSZip, buildingFilePathList: any[]): Array<Promise<string>> => {
    let buildingFilePromises: Array<Promise<string>> = [];
    for (let buildingFilePath of buildingFilePathList) {
        buildingFilePromises.push(zip.file(buildingFilePath).async("string"));
    }
    return buildingFilePromises;
};

const getGeolocation = (buildingInfoList: BuildingInfoObject[]): Array<Promise<void>> => {
    let buildingGeolocationPromises: Array<Promise<any>> = [];
    for (let buildingInfo of buildingInfoList) {
        let url: string = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team068/";
        let address: string = buildingInfo.address.replace(/\s/g, "%20");
        url = url.concat(address);
        let geolocationPromise = new Promise<any>((resolve, reject) => {
            http.get(url, ( response) => {
                // response is result of connection to the url
                const { statusCode } = response;
                if (statusCode !== 200) {
                    return reject(new InsightError("connect status is not 200, not successful"));
                }
                response.setEncoding("utf8");
                // after connection is successful, get raw data chunk by chunk until all data is transferred.
                let rawData = "";
                response.on("data", (chunk) => {
                    rawData += chunk;
                });
                // after data is transferred check the result
                // the result will be either lat & lon, or error, but never both
                // interface GeoResponse {lat: number; lon: number; error: string;}
                response.on("end", () => {
                    try {
                        const parsedData = JSON.parse(rawData);
                        if (parsedData.error !== undefined) {
                            return reject(new InsightError("response result is error"));
                        }
                        buildingInfo.lon = parsedData.lon;
                        buildingInfo.lat = parsedData.lat;
                        return resolve();
                    } catch (error) {
                        throw new InsightError("getting geolocation got error");
                    }
                });
            });
        });
        buildingGeolocationPromises.push(geolocationPromise);
    }
    return buildingGeolocationPromises;
};

export const unzipParseHtmlRoom = (content: string, id: string, newDataset: Dataset, datasets: Dataset[],
                                   datasetId: string[]): Promise<string[]> => {
    let savedJSZip: JSZip;
    let buildingInfoList: BuildingInfoObject[];
    return JSZip.loadAsync(content, {base64: true})
        .then((zip: JSZip) => {
            savedJSZip = zip;
            let RoomFolder = zip.folder("rooms");
            return RoomFolder.file("index.htm").async("string");
        }).then ((htmlFile) => {
            buildingInfoList = parseJsonBuilding(htmlFile);
            return Promise.all(getGeolocation(buildingInfoList));
        }).then (() => {
            let buildingFileList: string[] = [];
            for (let building of buildingInfoList) {
                let buildingFilePath: string = "rooms".concat(building.path.substring(1));
                buildingFileList.push(buildingFilePath);
            }
            return Promise.all(getPromisesForReadBuildingFilesInZip(savedJSZip, buildingFileList));
        }).then ((buildingFiles) => {
            if (buildingFiles.length !== buildingInfoList.length) {
                throw new InsightError();
            }
            for (let i in buildingFiles) {
                buildingInfoList[i].file = buildingFiles[i];
            }
            let roomList: any[] = parseListOfJsonRoom(buildingInfoList);
            newDataset.addObjects(roomList);
            // write data into disk
            let savedFileName = __dirname.concat("/../../data/", id);
            if (roomList.length !== 0) {
                fs.writeFileSync(savedFileName, JSON.stringify(roomList));
            }
            datasetId.push(id);
            datasets.push(newDataset);
            return Promise.resolve(datasetId);
        }).catch((error) => Promise.reject(new InsightError(error)));
};

export const unzipCourse = (content: string, id: string, newDataset: Dataset, datasets: Dataset[], datasetId: string[]):
    Promise<string[]> => {
    return JSZip.loadAsync(content, {base64: true})
        .then((zip: JSZip) => {
            const coursesFolder: JSZip = zip.folder("courses");
            let filePromises: Array<Promise<string>> = [];
            coursesFolder.forEach((relativePath, file) => {
                filePromises.push(file.async("string"));
            });
            if (filePromises.length === 0) {
                throw new InsightError("the folder is empty");
            }
            return Promise.all(filePromises);
        }).then((files) => {
            let sectionList: any[] = [];
            for (let file of files) {
                sectionList = sectionList.concat(parseJsonCourse(file));
            }
            newDataset.addObjects(sectionList);
            // write data into disk
            let savedFileName = __dirname.concat("/../../data/", id);
            if (sectionList.length !== 0) {
                fs.writeFileSync(savedFileName, JSON.stringify(sectionList));
            }
            datasetId.push(id);
            datasets.push(newDataset);
            return Promise.resolve(datasetId);
    }).catch((error) => Promise.reject(new InsightError(error)));
};
