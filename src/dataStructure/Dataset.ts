import {InsightDatasetKind} from "../controller/IInsightFacade";

export default class Dataset {
    // objectList can be section list or room list
    private objectList: any[];
    private id: string;
    private kind: InsightDatasetKind;
    private numRows: number;

    constructor() {
        this.objectList = [];
        this.id = "";
        this.kind = null;
        this.numRows = 0;
    }

    // object can be room object or section object
    public addObjects(sections: any[]) {
        this.objectList = this.objectList.concat(sections);
        this.numRows = this.objectList.length;
    }

    // object can be room object or section object
    public getObjects() {
        return this.objectList;
    }

    public getId() {
        return this.id;
    }

    public setId(id: string) {
        this.id = id;
    }

    public getKind() {
        return this.kind;
    }

    public setKind(kind: InsightDatasetKind) {
        this.kind = kind;
    }

    public getNumRows() {
        return this.numRows;
    }

}
