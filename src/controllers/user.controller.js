const registerUser = async (req, res) => {
    try {
        res.status(200).json({
            message: "ok"
        });
    } catch (error) {
        res.status(500).json({
            message: "An error occurred",
            error: error.message
        });
    }
};

export { registerUser };