import Dataset from "../dataStructure/Dataset";
import {InsightDatasetKind, InsightError} from "../controller/IInsightFacade";
import fs = require("fs");

export const loadDatasetFromDisk = (datasets: Dataset[], datasetId: string[]) => {
    let path = __dirname.concat("/../../data/");
    try {
        let fileNames = fs.readdirSync(path);
        // if there are dataSets in the disk, load them to memory
        if (fileNames.length !== 0) {
            for (let fileName of fileNames) {
                path = path.concat(fileName);
                let newDataset = new Dataset();
                let objects = JSON.parse(fs.readFileSync(path).toString());
                newDataset.addObjects(objects);
                newDataset.setKind(InsightDatasetKind.Courses);
                newDataset.setId(fileName);
                datasets.push(newDataset);
                datasetId.push(fileName);
            }
        }
    } catch (error) {
        return;
    }
};

export const removeDatasetFromDisk = (datasetId: string): boolean => {
    let path = __dirname.concat("/../../data/");
    try {
        let fileNames = fs.readdirSync(path);
        // if there is a dataSet in the disk with given datasetId as a file name, remove it
        if (fileNames.includes(datasetId)) {
            path = path.concat(datasetId);
            fs.unlinkSync(path);
            return true;
        }
        return false;
    } catch (error) {
        throw new InsightError();
    }
};
