"use strict";
const pulumi = require("@pulumi/pulumi");
const { ec2, autoscaling, iam } = require("@pulumi/aws");
const cloudInit = require("@pulumi/cloudinit");
const { readFileSync } = require("fs")

const config = new pulumi.Config();

const instanceType = "t2.micro"
const availabilityZones = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
const appName = config.require("appName")
const appVer = config.require("appVer")
const repoURL = config.require("repoURL")
const keyName = config.require("keyName")

const ami = ec2.getAmi({
    filters: [
        {
            name: "name",
            values: ["RHEL-8.0.0_HVM-*"]
        },
        {
            name: "architecture",
            values: ["x86_64"]
        }
    ],
    mostRecent: true,
    owners: ["309956199498"]
})

const sg = new ec2.SecurityGroup("securityGroup", {
    ingress: [{
        fromPort: 80,
        toPort: 80,
        protocol: "tcp",
        cidrBlocks: ["0.0.0.0/0"],
    }, {
        fromPort: 22,
        toPort: 22,
        protocol: "tcp",
        cidrBlocks: ["0.0.0.0/0"],
    }],
    egress: [{
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
        ipv6CidrBlocks: ["::/0"],
    }]
})

const resourceConf = new cloudInit.Config("cloudinit", {
    gzip: false,
    base64Encode: true,
    parts: [{
        contentType: "text/cloud-config",
        content: readFileSync("scripts/cloud-config.yaml").toString(), // TODO: file pathing
    }]
})

ami.then(ami => {

    const launchTemplateA = new ec2.LaunchTemplate("launchTemplateA", {
        namePrefix: "launchTemplateA",
        imageId: ami.id,
        instanceType,
        keyName,
        tagSpecifications: [{
            resourceType: "instance",
            tags: {
                appName,
                appVer,
                appRole: "clusterA",
                repoURL,
            }
        }],
        metadataOptions: {
            httpEndpoint: "enabled",
            httpTokens: "optional",
            httpPutResponseHopLimit: 1,
            instanceMetadataTags: "enabled",
        },
        userData: resourceConf.rendered,
        vpcSecurityGroupIds: [sg.id],
    })

    const launchTemplateB = new ec2.LaunchTemplate("launchTemplateB", {
        namePrefix: "launchTemplateB",
        imageId: ami.imageId,
        instanceType,
        keyName,
        tagSpecifications: [{
            resourceType: "instance",
            tags: {
                appName,
                appVer,
                appRole: "clusterA",
                repoURL,
            }
        }],
        metadataOptions: {
            httpEndpoint: "enabled",
            httpTokens: "optional",
            httpPutResponseHopLimit: 1,
            instanceMetadataTags: "enabled",
        },
        userData: resourceConf.rendered,
        vpcSecurityGroupIds: [sg.id],
    })

    const asgA = new autoscaling.Group("asgA", {
        availabilityZones,
        desiredCapacity: 1,
        maxSize: 3,
        minSize: 1,
        launchTemplate: {
            id: launchTemplateA.id,
            version: '$Latest',
        }
    })

    const asgB = new autoscaling.Group("asgB", {
        availabilityZones,
        desiredCapacity: 1,
        maxSize: 3,
        minSize: 1,
        launchTemplate: {
            id: launchTemplateB.id,
            version: '$Latest',
        }
    })

})


