const asyncHandler = (func) = async (req, res, next) => {
    try {
        await func(res, res, next);
    } catch (error) {
        res.send(error.code || 500).json({
            success: false,
            message: error.message
        })
    }
}

export {asyncHandler};