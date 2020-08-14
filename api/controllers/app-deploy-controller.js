const utils = require("../../utils/utils");
const appDeployerUtils = require("./app-deploy-utils");

exports.renderAppDeployPage = async function(req, res){
    //receive the Base64 encoded GET params from the nunjucks page
    const encodedGatewayIP = req.query.ip;

    if(encodedGatewayIP) {
        const gatewayIP = utils.decodeFromBase64(encodedGatewayIP);

        const linkGraph = await utils.getLinkGraphData(gatewayIP); //get the link graph
        const linkGraphData = linkGraph["data"]; //{"G1": {"devices": [{"id": "d1",..}, {},..], ..}, "G2": {},...}

        const gateways = Object.keys(linkGraphData); //get the gateway ids => ["G1", "G2",..]
        const allDeviceIds = gateways.flatMap(gateway =>
            linkGraphData[gateway]["devices"].map(deviceData => deviceData["id"])
        ); //[["d1", "d2"], ["d3", ..], ...]

        // allDeviceIds still contains duplicate deviceIds, since two gateways can have the same deviceId
        // remove duplicates by creating a set and then converting back to a list
        const deviceList = Array.from(new Set(allDeviceIds));

        const data = {
            /*
            pass on the gateway IP so that once the form submission happens on the app-deploy-page, the deployApp
            function can use the gatewayIP to get the link graph of the network
             */
            "gatewayIP": gatewayIP,
            "devices": deviceList
        };
        res.render("app-deploy-page.nunjucks", data);
    } else {
        res.sendStatus(404);
    }
};

exports.deployApp = async function (req, res) {
    //Get the POST data
    const appPath = req["files"]["app"][0]["path"]; //path to the app
    let devices = req.body.devices; //list of deviceIds
    // check `devices` type. if only 1 device is selected, req.body.devices will be a string. Otherwise, it will be an array.
    if(typeof devices === "string") {
        devices = [devices];
    }
    const gatewayIP = req.body.gatewayIP;

    //generate the link graph
    const linkGraph = await utils.getLinkGraphData(gatewayIP);

    //deploy the app
    appDeployerUtils.deployApp(appPath, devices, linkGraph, function(isDeploymentSuccessful) {
        const deploymentAlertMessage = isDeploymentSuccessful ? "App deployed on gateway network!" :
            "App deployment failed!";

        const data = {
            "deploymentAlertMessage": deploymentAlertMessage
        };
        res.render("deployment-response-page.nunjucks", data);
    });
};