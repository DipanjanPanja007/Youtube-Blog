

// const asyncHandler = () => {}
// const asyncHandler = (func) => {() => {}}            // passing a function as argument
// const asyncHandler = (func) => {async() => {}}
// const asyncHandler = (func) => async() => {}

// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn( req, res, next)
//     } catch (error) {
//         res.status(error.code || 500 ).json({
//             success: false,
//             message: error.message,
//         })
//     }
// }

const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise
            .resolve(requestHandler(req, res, next))
            .catch((error) => next(error))                    // If you pass an argument, like next(error), it signals 
    }                                                         // that there was an error and Express will skip all the
}                                                             // remaining middleware and jump to the error-handling 
                                                              // middleware.

export { asyncHandler }


     
  
