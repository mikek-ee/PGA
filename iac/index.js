"use strict";
const pulumi = require("@pulumi/pulumi");
const { ec2, autoscaling } = require("@pulumi/aws");

const config = new pulumi.Config();

const instanceType = "t2.micro"
const availabilityZones = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
const appName = config.require("appName")
const appVer = config.require("appVer")

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

const launchTemplateA = new ec2.LaunchTemplate("launchTemplateA", {
    namePrefix: "launchTemplateA",
    imageId: ami.imageId,
    instanceType,
    tagSpecifications: [{
        resourceType: "instance",
        tags: {
            appName,
            appVer,
            appRole: "clusterA",
        }
    }],
    userData: "",
})

const launchTemplateB = new ec2.LaunchTemplate("launchTemplateB", {
    namePrefix: "launchTemplateA",
    imageId: ami.imageId,
    instanceType,
    tagSpecifications: [{
        resourceType: "instance",
        tags: {
            appName,
            appVer,
            appRole: "clusterA",
        }
    }],
    userData: "",
})

const asgA = new autoscaling.Group("asgA", {
    availabilityZones,
    desiredCapacity: 2,
    maxSize: 3,
    minSize: 1,
    launchTemplate: {
        id: launchTemplateA.id,
        version: '$Latest',
    }
})

const asgB = new autoscaling.Group("asgB", {
    availabilityZones,
    desiredCapacity: 2,
    maxSize: 3,
    minSize: 1,
    launchTemplate: {
        id: launchTemplateB.id,
        version: '$Latest',
    }
})

