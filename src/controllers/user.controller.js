import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"



const generateAccessAndRefreshTokens = async (userId) =>{

    /*
     * generate Access and Refresh Token, 
     * Update refresh Token into db ( just update refreshToken, else untouched )
     * return Access and Refresh Token
     */

    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500 , "Something went wrong while generating Access and Refresh Token");
    }
}


const registerUser = asyncHandler( async (req, res) => {
    /*
     * Step#1: get user details from frontend
     * Step#2: validation - not empty
     * Step#3: check if uer already exists : username, email
     * Step#4: check for images, check for avatar
     * Step#5: upload them on cloudnary, avatar 
     * Step#6: create user object - create entry in db
     * Step#7: remove password and refresh token field from response
     * Step#8: check for user creation 
     * Step#9: return response 
     */

    // Step#1: get user details from frontend  ( text data->from body, images->from multer-middleware-fields)

    // console.log(`printing request: ${JSON.stringify(req.body)}`);               // testing
    const { fullName, email, username, password } =  req.body;

    // Step#2: validation - not empty
    if(  [fullName, email, username, password].some((field) => field?.trim() === "")  ){
        throw new ApiError(400, "All fields are required...");
    }

    // Step#3: check if uer already exists : username, email
    const existedUser = await User.findOne({
        $or: [ { username }, { email } ]
    })
    if(existedUser){
        throw new ApiError(409 , "User with same Username or email already exists ")
    }

    // Step#4: check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    let coverImageLocalPath ="";
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){         // check if user provided coverImage or not
        coverImageLocalPath = req.files.coverImage[0]?.path;
    }


    
    // Step#5: upload them on cloudnary, avatar 
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);             //******
    if(!avatar){
        throw new ApiError(400, "Avatar is required")
    }

    // Step#6: create user object - create entry in db
    const user = await User.create({
        fullName,
        email,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password,
        username: username.toLowerCase(),
    });


    // Step#7: remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(                      // select takes a string, "-" sign means here except
        "-password -refreshToken"
    )

    // Step#8: check for user creation 
    if(!createdUser){
        throw new ApiError(500, "Something is wrong while registering you...")
    }

    // Step#9: return response 
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

});


const loginUser = asyncHandler( async(req, res) => {

    /*
     * Step#1: take input from req.body
     * Step#2: username or email based login (you can change)
     * Step#3: search for user with given info in database
     * Step#4: check password if correct
     * Step#5: generate access and refresh token 
     * Step#6: send token as cookie or header 
     */


    // Step#1: take input from req.body
    const {email, username, password} = req.body;

    // Step#2: username or email based login (you can change)
    if(!(username || email)){
        throw new ApiError(400, "Username or email required ... ");
    }

    // Step#3: search for user with given info in database
    const user = await User.findOne( {
        $or : [{ username } , { email }]                           // search with the username or email whatever
    } )
    if(!user){
        throw new ApiError(404, "User does not exists")
    }


    // Step#4: check password if correct
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "Wrong password ... ");
    }

    // Step#5: generate access and refresh token 
    const {accessToken , refreshToken} = await generateAccessAndRefreshTokens(user._id);

    
    // Step#6: send token as cookie or header 
    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken" )
    
    const options = {
        httpOnly :true,                     // cookie can be modified by server only
        secure: true,     
    }
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
});


const logoutUser= asyncHandler( async(req, res) => {

    /*
     * access id from req.user
     * delete refreshToken of the user from db ($set : {refreshToken: undefined}) and also make sure updated version is get
     * then clear cookies: i.e. accessToken and refreshToken
     */

    await User.findByIdAndUpdate(
        req.user._id,                                           // find by id (req.user._id)
        {
            $set : {refreshToken: undefined}                    // delete refreshToken 
        },
        {
            new : true                                          // in response it will send the new object
        }
    )

    const options = {
        httpOnly :true,                     // cookie can be modified by server only
        secure: true,     
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {} , "User logged out"))
});

const refreshAccessToken = asyncHandler( async(req, res) => {

    /* After some time of login, `Access token` expires -> user gets 401 responce,
    * then user have to login once again 😥
    * there a better suggestion came: match user's RefreshToken(present in cookie or body) with db's Refresh Token if same.
    * if matches->ok User.Then a set of fresh RefreshToken and Access Token generated, Refresh Token updated to db, and a set sent to user .
    * When Access token expires, the cycle begins. 
    * Here user doesn't need to login again and again 😎😀😎😀
    * But take care of security 🔐🔓
    */ 

    // take refresh token from cookie
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        // verify refresh token and get decoded refresh token
        const decodedRefreshToken = jwt.verify(incomingRefreshToken , process.env.REFRESH_TOKEN_SECRET);
    
        // in out refresh token, we have encoded _id of user, there find the user 
        const user = await User.findById(decodedRefreshToken?._id);
    
        if(!user){
            throw new ApiError(401, "invalid Refresh Token from user ");
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401 , "Refresh Token Expired or used");
        }
    
        // take care of security 🔐🔓
        const options = { 
            httpOnly: true,
            secure: true
        }
    
        // generate a set of fresh RefreshToken and Access Token, and update into db
        const {newAccessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)


        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200, 
                    {
                        accessToken: newAccessToken, 
                        refreshToken: newRefreshToken
                    }, 
                    "Access Token refreshed Successfully"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token");
    }

});


const changeCurrentPassword = asyncHandler( async(req, res) => {

    // take old and new password from user body
    const { oldPassword , newPassword } = req.body;

    // find user in db by userid collected from req.user
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);            // check if given old password is correct 

    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid old Password");
    }

    // set local user.password as new one
    user.password = newPassword;

    await user.save({validateBeforeSave: false})         // we don't want other fields to be touched in db

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                {},
                "Password updated Successfully"
            )
        )    
});


const getCurrentUser = asyncHandler( async(req, res) =>{

    // user is available because of middleware, so just return req.user
    return res
        .status(200)
        .json(
            new ApiResponse(
                200 , 
                req.user,
                "Current user fetched successfully"
            )
        )
});

const updateAccountDetails = asyncHandler (async(req, res) => {

    // change fullName and email
    const { fullName, email } = req.body;

    if(!fullName || !email){
        throw new ApiError(401, "All fields are required");
    }

    const user = await User.findOneAndUpdate(
        req.user._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                user,
                "Account details updated successfully"
            )
        )
});

const updateUserAvatar = asyncHandler (async(req, res) => {

    // check if file is given or not, if given, take it's path
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    // upload in cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400, "Something went wrong while uploading avatar on Cloudinary")
    }

    const user = await User.findOneAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url                         // update avatar url
            }
        },
        {new: true}
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                user,
                "Updated User Avatar successfully "
            )
        )
});

const updateUserCoverImage = asyncHandler ( async(req, res) => {

    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath){
        throw new ApiError(400, "CoverImage file is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400, "Something went wrong while uploading coverImage on Cloudinary")
    }

    const user = await User.findOneAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                user,
                "Updated User coverImage successfully "
            )
        )
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}
