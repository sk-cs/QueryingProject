import Log from "../Util";
import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, NotFoundError} from "./IInsightFacade";
import {handleQueryCourse} from "../dataFunctions/QueryPerform";
import {loadDatasetFromDisk, removeDatasetFromDisk} from "../dataFunctions/DatasetDiskHelper";
import {unzipCourse, unzipParseHtmlRoom} from "../dataFunctions/DatasetHelper";
import Dataset from "../dataStructure/Dataset";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
interface Section {
    [key: string]: string;
}

export default class InsightFacade implements IInsightFacade {
    private datasetId: string[];
    private datasets: Dataset[];
    private count: number;

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
        this.datasetId = [];
        this.datasets = [];
        this.count = 0;
        loadDatasetFromDisk(this.datasets, this.datasetId);
    }

    public getDatasetsOfId(id: string): any[] {
        for (let dataset of this.datasets) {
            if (dataset.getId() === id) {
                return dataset.getObjects();
            }
        }
        const emptyResult: any[] = [];
        return emptyResult;
    }

    public getDatasetsKind(id: string): InsightDatasetKind {
        for (let dataset of this.datasets) {
            if (dataset.getId() === id) {
                return dataset.getKind();
            }
        }
        return null;
    }

    public getDatasetId(): string[] {
        return this.datasetId;
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        if (id === null || content == null || id.includes("_")) {
            return Promise.reject(new InsightError("invalid id and content"));
        }
        if (this.datasetId.includes(id)) {
            return Promise.reject(new InsightError("id already exist"));
        }
        if (kind !== InsightDatasetKind.Courses && kind !== InsightDatasetKind.Rooms) {
            return Promise.reject(new InsightError("invalid kind"));
        }
        // make new dataset object
        let newDataset = new Dataset();
        newDataset.setId(id);
        newDataset.setKind(kind);
        // read a zip file
        if (kind === InsightDatasetKind.Rooms) {
            return unzipParseHtmlRoom(content, id, newDataset, this.datasets, this.datasetId);
        } else if (kind === InsightDatasetKind.Courses) {
            return unzipCourse(content, id, newDataset, this.datasets, this.datasetId);
        }
    }

    public removeDataset(id: string): Promise<string> {

        if (id === null) {
            return Promise.reject(new InsightError("id is null"));
        }
        if (id === " ") {
            return Promise.reject(new InsightError("id is empty string"));
        }
        if (id.includes("_")) {
            return Promise.reject(new InsightError("id should not include _"));
        }
        if (this.datasetId === []) {
            return Promise.reject(new NotFoundError("dataset is empty"));
        }

        return new Promise<string>(
            (resolve, reject) => {
                let isRemoved = false;
                try {
                    isRemoved = removeDatasetFromDisk(id);
                } catch (error) {
                    return reject(error);
                }
                if (this.datasetId.includes(id)) {
                    this.datasets.splice(this.datasetId.indexOf(id), 1);
                    this.datasetId.splice(this.datasetId.indexOf(id), 1);
                    isRemoved = true;
                }
                if (isRemoved) {
                    return resolve(id);
                } else {
                    return reject(new NotFoundError());
                }
            }
        );
    }

    public performQuery(query: any): Promise<any[]> {

        if (this.datasets.length !== 0) {
            //  check the validation of course containing query
            try {
                const result = handleQueryCourse(query, this);
                return Promise.resolve(result);
            } catch (error) {
                return Promise.reject(error);
            }
        }
        return Promise.reject(new InsightError("datasets is empty"));
    }

    public listDatasets(): Promise<InsightDataset[]> {
        let datasetList: InsightDataset[];
        datasetList = [];

        this.datasets.forEach(
            (data) => {
                let insightDataset = {} as InsightDataset;
                insightDataset.id = data.getId();
                insightDataset.kind = data.getKind();
                insightDataset.numRows = data.getNumRows();
                datasetList.push(insightDataset);
            }
        );
        return Promise.resolve(datasetList);
    }

}
