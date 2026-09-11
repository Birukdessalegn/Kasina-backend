const employeesService = require("./employees.service");


// GET /api/employees
const getEmployees = async (req, res) => {
  try {
    const employees = await employeesService.getAllEmployees();

    res.json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("Get employees error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
    });
  }
};


// GET /api/employees/:id
const getEmployee = async (req, res) => {
  try {
    const employee = await employeesService.getEmployeeById(
      req.params.id
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error("Get employee error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch employee",
    });
  }
};


// POST /api/employees
const createEmployee = async (req, res) => {
  try {
    console.log("CREATE EMPLOYEE PAYLOAD:", req.body);

    const {
      username,
      password,
    } = req.body;

    const targetFirstName = req.body.firstName || req.body.first_name;
    const targetLastName = req.body.lastName || req.body.last_name;
    const targetRole = req.body.roleName || req.body.role || req.body.roleId || req.body.role_id;

    if (!targetFirstName || !targetLastName) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required",
      });
    }

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Username and password are required for the employee login",
      });
    }

    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    const result =
      await employeesService.createEmployee(req.body);

    res.status(201).json({
      success: true,
      message:
        "Employee and login account created successfully",

      employee: result.employee,

      user: result.user,
    });

  } catch (error) {
    console.error("Create employee error:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// PUT /api/employees/:id
const updateEmployee = async (req, res) => {
  try {
    const employee = await employeesService.updateEmployee(
      req.params.id,
      req.body
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      message: "Employee updated successfully",
      employee,
    });
  } catch (error) {
    console.error("Update employee error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update employee",
    });
  }
};

// PUT /api/employees/:id/activate
const activateEmployee = async (req, res) => {
  try {
    const employee = await employeesService.activateEmployee(
      req.params.id
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      message: "Employee activated successfully",
      employee,
    });

  } catch (error) {
    console.error("Activate employee error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to activate employee",
    });
  }
};
// DELETE /api/employees/:id
const deleteEmployee = async (req, res) => {
  try {
    const employee = await employeesService.deleteEmployee(
      req.params.id
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      message: "Employee deactivated successfully",
    });
  } catch (error) {
    console.error("Delete employee error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to deactivate employee",
    });
  }
};

// DELETE /api/employees/:id/login-account
const deleteEmployeeAccount = async (req, res) => {
  try {
    const result = await employeesService.deleteEmployeeAccount(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      message: result.message || "Employee login account removed successfully.",
    });
  } catch (error) {
    console.error("Delete employee login account error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to remove employee login account",
    });
  }
};


// GET /api/employees/hierarchy
const getHierarchy = async (req, res) => {
  try {
    const hierarchy = await employeesService.getEmployeeHierarchy();
    res.json({
      success: true,
      count: hierarchy.length,
      hierarchy,
    });
  } catch (error) {
    console.error("Get hierarchy error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch organizational hierarchy",
    });
  }
};

// GET /api/employees/outlets
const getOutlets = async (req, res) => {
  try {
    const outlets = await employeesService.getAllOutlets();
    res.json({
      success: true,
      count: outlets.length,
      outlets,
    });
  } catch (error) {
    console.error("Get outlets error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch outlets",
    });
  }
};

// GET /api/employees/positions
const getPositions = async (req, res) => {
  try {
    const positions = await employeesService.getAllPositions();
    res.json({
      success: true,
      count: positions.length,
      positions,
    });
  } catch (error) {
    console.error("Get positions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch positions",
    });
  }
};

// GET /api/employees/roles
const getRoles = async (req, res) => {
  try {
    const roles = await employeesService.getAllRoles();
    res.json({
      success: true,
      count: roles.length,
      roles,
    });
  } catch (error) {
    console.error("Get roles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
    });
  }
};

// GET /api/employees/departments
const getDepartments = async (req, res) => {
  try {
    const departments = await employeesService.getAllDepartments();
    res.json({
      success: true,
      count: departments.length,
      departments,
    });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
    });
  }
};

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  activateEmployee,
  deleteEmployeeAccount,
  getHierarchy,
  getOutlets,
  getPositions,
  getRoles,
  getDepartments,
};