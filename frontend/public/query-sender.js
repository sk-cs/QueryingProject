/**
 * Receives a query object as parameter and sends it as Ajax request to the POST /query REST endpoint.
 *
 * @param query The query object
 * @returns {Promise} Promise that must be fulfilled if the Ajax request is successful and be rejected otherwise.
 */
CampusExplorer.sendQuery = (query) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = "/query";
        xhr.open("POST", url);
        xhr.onload = function () {
            resolve(xhr.responseText);
        };
        xhr.onerror = function () {
            reject(error);
        };
        xhr.send(JSON.stringify(query));
    });
};
