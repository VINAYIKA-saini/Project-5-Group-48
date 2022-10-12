const userModel = require("../models/userModel")
const check = require("../utility/validator")
const bcrypt = require("bcrypt");
const aws = require("aws-sdk")
const jwt = require("jsonwebtoken")

//=============================================configure AWS===============================================================
aws.config.update({
    accessKeyId: "AKIAY3L35MCRUJ6WPO6J",
    secretAccessKey: "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",
    region: "ap-south-1"
});
let uploadFile = async (file) => {
    return new Promise(function (resolve, reject) {
        // this function will upload file to aws and return the link
        let s3 = new aws.S3({ apiVersion: '2006-03-01' });

        var uploadParams = {
            ACL: "public-read",
            Bucket: "classroom-training-bucket",
            Key: "abc/" + file.originalname,
            Body: file.buffer
        }
        s3.upload(uploadParams, function (err, data) {
            if (err) {
                return reject({ "error": err.message })
            }
            console.log("file uploaded succesfully")
            return resolve(data.Location)
        })
    })
}
//==================================================create user===============================================================================

const createUser = async function (req, res) {
    try {
        const data = req.body
        let { fname, lname, email, phone, password, address } = data

        const files = req.files

        if (!fname) { return res.status(400).send({ status: false, message: "Fname is mandatory" }) };
        if (!check.isValidname(fname)) { return res.status(400).send({ status: false, message: "Fname should be in Alphabets" }) };
        if (!lname) { return res.status(400).send({ status: false, message: "Lname is mandatory" }) };
        if (!check.isValidname(lname)) { return res.status(400).send({ status: false, message: "Lname should be in Alphabets" }) };
        if (!email) { return res.status(400).send({ status: false, message: "email is mandatory" }) };
        if (!check.isVAlidEmail(email)) { return res.status(400).send({ status: false, message: "Email should be valid" }) };
        if (!password) { return res.status(400).send({ status: false, message: "Password is mandatory" }) };
        if (!check.isValidPassword(password)) { return res.status(400).send({ status: false, message: "Password should be valid" }) };
        if (!phone) { return res.status(400).send({ status: false, message: "Phone is mandatory" }) };
        if (!check.isValidPhone(phone)) { return res.status(400).send({ status: false, message: "Phone should be valid" }) };
        if (!phone) { return res.status(400).send({ status: false, message: "Phone is mandatory" }) };
        if (!address) return res.status(400).send({ status: false, Message: "Address is mandatory" })


        let checkEmail = await userModel.findOne({ email });
        if (checkEmail) return res.status(400).send({ status: false, Message: "This email is already registered" });

        let checkPassword = await userModel.findOne({ phone });
        if (checkPassword) return res.status(400).send({ status: false, Message: "This Phone is already registered" });
        const encryptedPassword = await bcrypt.hash(password, 10)

        if (files && files.length == 0)
            return res.status(400).send({ status: false, message: "Profile Image is required" });
        else if (!check.isValidImage(files[0]))
            return res.status(400).send({ status: false, message: "Profile Image is required as an Image format", });
        else data.profileImage = await uploadFile(files[0])

        address = JSON.parse(data.address)

        if (!address.shipping) return res.status(400).send({ status: false, Message: "shipping address is madatory" })
        if (!(address.shipping.street)) return res.status(400).send({ status: false, Message: "shipping street is madatory" });
        if (!check.isValidStreet(address.shipping.street)) return res.status(400).send({ status: false, Message: "Provide valid shipping street" });
        if (!(address.shipping.city)) return res.status(400).send({ status: false, Message: " shipping city is madatory" });
        if (!(address.shipping.pincode)) return res.status(400).send({ status: false, Message: "shopping pincode is madatory" });
        if (!check.isValidPincode(address.shipping.pincode)) return res.status(400).send({ status: false, Message: "Plz provide a valid shipping pincode" });

        if (!(address.billing)) return res.status(400).send({ status: false, Message: "billing address is madatory" });
        if (!(address.billing.street)) return res.status(400).send({ status: false, Message: "billing street is madatory" });
        if (!check.isValidStreet(address.billing.street)) return res.status(400).send({ status: false, Message: "Provide valid billing street" });
        if (!(address.billing.city)) return res.status(400).send({ status: false, Message: "billing city is madatory" });
        if (!address.billing.pincode) return res.status(400).send({ status: false, Message: "billing pincode is madatory" });
        if (!check.isValidPincode(address.billing.pincode)) return res.status(400).send({ status: false, Message: "Plz provide a valid billing pincode" });


        const userDetails = { fname, lname, email, phone, profileImage: profileImage, password: encryptedPassword, address: address }

        const newUser = await userModel.create(userDetails);
        return res.status(201).send({ status: true, message: "User created successfully", data: newUser });

    } catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}

//===================================================loginuser================================================================================

const userLogin = async function (req, res) {
    try {

        let data = req.body

        let { email, password } = data
        if (!check.isValidreqbody(data)) return res.status(400).send({ status: false, message: "Please provide login details" })

        if (!email) {
            return res.status(400).send({ status: false, message: "Email is required!!" })
        }

        // check email for user
        let user = await userModel.findOne({ email: email });
        if (!user) return res.status(400).send({ status: false, message: "Email is not correct, Please provide valid email" });

        if (!password) {
            return res.status(400).send({ status: false, message: "Password is required!!" })
        }

        // check password of existing user
        let pass = await bcrypt.compare(password, user.password)
        if (!pass) return res.status(400).send({ status: false, message: "Password is not correct, Please provide valid password" });

        // using jwt for creating token
        let token = jwt.sign(
            {
                userId: user._id.toString(),
                exp: Math.floor(Date.now() / 1000) + (60 * 60),
                iat: new Date().getTime()
            },
            "Project5-Group48"
        );

        res.status(201).send({ status: true, message: "User login successfully", data: { userId: user._id, token: token } });
    }
    catch (error) {
        res.status(500).send({ status: false, message: error.message });
    }
}
//================================================GetUser==================================================================================
const getUser = async function (req, res) {
    try {
        let userId = req.params.userId

        if (!check.isValidObjectId(userId)) {
            return res.status(400).send({ status: false, message: "Enter valid user Id" })
        }

        let user = await userModel.findOne({ userId })
        if (!user) {
            return res.status(404).send({ status: false, message: "user not found" })
        }

        res.status(200).send({ status: true, message: 'User profile details', data: user })
    }
    catch (error) {
        res.status(500).send({ status: false, message: error.message });
    }
}

//==============================================update=====================================================================================

const updateUser = async function (req, res) {
    try {
        let userId = req.params.userId
        if (!check.isValidObjectId(userId)) return res.status(400).send({ status: false, message: "Enter valid user Id" })
        const files = req.files

        const userdata = JSON.parse(JSON.stringify(req.body));
        let { fname, lname, email, phone, password, address } = userdata;

        if (!check.isValidreqbody(userdata)) return res.status(400).send({ status: false, message: "Enter data which you want to update" })


        if (!check.isValidname(fname)) {
            return res.status(400).send({ status: false, message: "Fname should be valid" })
        }
        userdata.fname = fname


        if (!check.isValidname(fname)) {
            return res.status(400).send({ status: false, message: "lname should be valid" })
        }
        userdata.lname = lname


        if (!check.isVAlidEmail(email)) { return res.status(400).send({ status: false, message: "Email should valid" }) };
        let duplicateEmail = await userModel.findOne({ email: email })
        if (duplicateEmail) return res.status(400).send({ status: false, Message: "This email is already exists" });
        userdata.email = email;

        if (!check.isValidPassword(password)) { return res.status(400).send({ status: false, message: "Password should be valid" }) };
        const encryptedPassword = await bcrypt.hash(password, 10)
        userdata.password = encryptedPassword

        if ((!check.isValidPhone(phone))) { return res.status(400).send({ status: false, message: "Phone should be valid" }) };
        let duplicatePhone = await userModel.findOne({ email: email })
        if (duplicatePhone) return res.status(400).send({ status: false, Message: "This phone number is already exists" });


        if (files && files.length == 0)
            return res.status(400).send({ status: false, message: "Profile Image is required" });
        else if (!check.isValidImage(files[0]))
            return res.status(400).send({ status: false, message: "Profile Image is required as an Image format", });
        else userdata.profileImage = await uploadFile(files[0])

        if (address) {
            userdata.address = JSON.parse(userdata.address)
            if (typeof userdata.address != "object") return res.status(400).send({ status: false, message: "Address should be in object format" })
            let { shipping, billing } = userdata.address

            if (shipping) {
                if (typeof shipping != "object") { return res.status(400).send({ status: false, Message: "Enter shipping address in object format" }) }

                if (!(shipping.street)) return res.status(400).send({ status: false, Message: "shipping street is madatory" });
                if (!check.isValidStreet(shipping.street)) return res.status(400).send({ status: false, Message: "Provide valid shipping street" });
                if (!(shipping.city)) return res.status(400).send({ status: false, Message: " shipping city is madatory" });
                if (!(userdata.address.shipping.pincode)) return res.status(400).send({ status: false, Message: "shopping pincode is madatory" });
                if (!check.isValidPincode(userdata.address.shipping.pincode)) return res.status(400).send({ status: false, Message: "Plz provide a valid shipping pincode" });
            }

            if (billing) {
                if (typeof billing != "object") { return res.status(400).send({ status: false, Message: "Enter billing address in object format" }) }

                if (!(billing.street)) return res.status(400).send({ status: false, Message: "billing street is madatory" });
                if (!check.isValidStreet(billing.street)) return res.status(400).send({ status: false, Message: "Provide valid billing street" });
                if (!(billing.city)) return res.status(400).send({ status: false, Message: "billing city is madatory" });
                if (!(userdata.address.billing.pincode)) return res.status(400).send({ status: false, Message: "billing pincode is madatory" });
                if (!check.isValidPincode(userdata.address.billing.pincode)) return res.status(400).send({ status: false, Message: "Plz provide a valid billing pincode" });
            }
        }

        let updateUserData = await userModel.findOneAndUpdate({ _id: userId }, userdata, { new: true })

        res.status(200).send({ status: true, message: 'User profile updated', data: updateUserData })

    }

    catch (error) {
        res.status(500).send({ status: false, message: error.message });
    }
}


module.exports = { createUser, userLogin, getUser, updateUser }