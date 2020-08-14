const fs = require('fs-extra');
const utils = require('../../utils/utils');
const path = require('path');

/**
 * Given a list of devices and the current link graph of the network, finds out which gateways host those devices.
 * Returns a dictionary of gateway->[sensor-ids]
 * @param devicesIds List of sensor ids
 * @param linkGraph Current link graph of the network
 * @returns {Promise<{}>} Promise object of the gateway->[sensor-id] mapping
 */
async function getHostGateways(devicesIds, linkGraph) {
    const gatewayToSensorMapping = {};
    const data = linkGraph["data"];

    for (const [gatewayId, gatewayData] of Object.entries(data)) {
        const gatewayDeviceList = gatewayData["devices"];
        const gatewayIp = gatewayData["ip"];

        //for each device given to us, find out if that is present in the device list of the current gw
        for (let i = 0; i < devicesIds.length; i++) {
            const targetDeviceId = devicesIds[i];
            const matchFound = gatewayDeviceList.find(function (device) {
                return device["id"] === targetDeviceId;
            });
            //there's a match
            if (matchFound) {
                if (gatewayIp in gatewayToSensorMapping) {
                    gatewayToSensorMapping[gatewayIp].push(targetDeviceId);
                } else {
                    gatewayToSensorMapping[gatewayIp] = [targetDeviceId];
                }
            }
        }
    }
    return gatewayToSensorMapping;
}

/**
 * Given a mapping of type gateway->[deviceId], return the IP of the gateway with the most number of devices.
 * @param gatewayDeviceMapping
 * @returns {string}
 */
function getIdealGateway(gatewayDeviceMapping) {
    return Object.keys(gatewayDeviceMapping)
        .reduce(function (gatewayI, gatewayJ) {
            return (gatewayDeviceMapping[gatewayI].length >= gatewayDeviceMapping[gatewayJ].length) ? gatewayI : gatewayJ;
        });
}

function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch (err) {
        console.error(err);
    }
}

/**
 * Given an app, the device ids that the app uses, and the current link graph of the network, this function generates
 * a metadata file containing the gateways that house the devices, then identifies the best gateway to run the app, and
 * uses the Gateway API on that gateway to execute the app.
 * @param appPath Path to the app
 * @param devices List of device ids
 * @param linkGraph
 * @param appDeploymentCallback Indicates whether the app deployment was successful or not using a boolean argument
 */
exports.deployApp = function(appPath, devices, linkGraph, appDeploymentCallback) {
    getHostGateways(devices, linkGraph).then(mapping => {
        const targetGatewayIP = getIdealGateway(mapping);

        //store the metadata to a file
        const metadata = {"deviceMapping": mapping};
        const metadataPath = path.join(__dirname, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata));

        //deploy the code using the Gateway API on the target gateway
        const appFiles = {
            app: appPath,
            metadata: metadataPath
        };

        utils.executeAppOnGateway(targetGatewayIP, appFiles, function() {
                appDeploymentCallback(true);
                deleteFile(appPath);
                deleteFile(metadataPath);
            },
            function() {
                appDeploymentCallback(false);
                deleteFile(appPath);
                deleteFile(metadataPath);
            })
    });
};