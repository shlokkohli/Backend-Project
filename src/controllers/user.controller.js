import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt, { decode } from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) => {
  try {

    const user = await User.findById(userId) // trying to find that specific user in the db
    const accessToken = user.generateAccessToken() // this will store the access token
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken // in the user variable, write the value inside the refresh token field
    await user.save( {validateBeforeSave: false} ) // save the refresh token in the user db because it will be needed repeatedly to generate access token

    return {accessToken, refreshToken}

  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating refresh and access token")
  }
}

const registerUser = asyncHandler(async (req, res) => {

  // Step 1: Get user details from frontend
  const { fullname, email, username, password } = req.body;


  // Step 2: Check if any of the fields are empty or not
  if(fullname === ""){
    throw new ApiError(400, "All fields are required");
  }
  if(email == ""){
    throw new ApiError(400, "All fields are required"); 
  }
  if(username == ""){
    throw new ApiError(400, "All fields are required");
  }
  if(password == ""){
    throw new ApiError(400, "All fields are required");
  }


  // Step 3: Checking if there is any duplicate user or not using the username and email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  })

  if(existedUser){
    throw new ApiError(409, "User with email or username already exists")
  }


  // Step 4: Check if avatar and profile picture is there or not

  // req.files is given by multer, this gives a detailed brief about the uploaded file such as file name, path, size etc
  // we are checking that in the all the files, if there is something named as avatar, if YES then =>
  // then select the filepath from of that avatar (if it is available)
  const avatarLocalPath = req.files?.avatar?.[0]?.path;

  // local path for cover Image
  let coverImageLocalPath;
  if(req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0){
      coverImageLocalPath = req.files.coverImage[0].path;
    }

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is required")
  }

  // upload the image to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // check again that if the avatar has been upload properly to cloudinary or not
  if(!avatar){
    throw new ApiError(400, "Avatar file is required")
  }


  // Step 5: if everything has been sent by the user properly so far, then take all of those values and create an entry in the db
  const user = await User.create({
    fullname: fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email: email,
    password: password,
    username: username.toLowerCase()
  })

  const createdUser = await User.findById(user._id).select("-password -refreshToken")

  if(!createdUser){
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  // Step 6: Send final response
  return res.status(200).json(
    new ApiResponse(200, createdUser, "User registered Successfully")
  )

});

const loginUser = asyncHandler(async (req,res) => {

  // Step 1: Take the user data
  const {email, username, password} = req.body;

  // check if there is email or not
  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  // Step 2: Check that username or email in the db for login
  const user = await User.findOne( {email} )

  if(!user){
    throw new ApiError(404, "User does not exist")
  }


  // Step 3: Check if the user password is correct or not
  const isPasswordValid = await user.isPasswordCorrect(password);
  if(!isPasswordValid){
    throw new ApiError(401, "Password user credentials")
  }


  // Step 4: If the user credentials are correct, then generate access and refresh tokens
  const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)


  // Step 5: Send the access token and refresh token to the user in cookies
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(200, {
      user: loggedInUser, accessToken, refreshToken
    }, "User Logged In Successfully")
  )

})

const logoutUser = asyncHandler(async (req,res) => {

  await User.findByIdAndUpdate(req.user._id,
    {
      $set: {refreshToken: undefined}
    },
      { new: true }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async (req,res) => {

  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if(incomingRefreshToken){
    throw new ApiError(401, "Unauthorized request")
  }

  const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

  const user = await User.findById(decodedToken._id)

  if(!user){
    throw new ApiError(401, "Invalid Refresh Token")
  }

  // if user wale refresh token is not equal to database wale refresh token then throw error
  if(incomingRefreshToken !== user.refreshToken){
    throw new ApiError(401, "Refresh token is expired or used")
  }

  const options = {
    httpOnly: true,
    secure: true
  }
  
  const {accessToken, newrefreshToken} = await generateAccessAndRefreshTokens(user._id)

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", newrefreshToken, options)
  .json(new ApiResponse(200, {accessToken, refreshToken: newrefreshToken},
    "Access Token Refreshed Successfully"
  ))

})

export { registerUser, loginUser, logoutUser, refreshAccessToken };