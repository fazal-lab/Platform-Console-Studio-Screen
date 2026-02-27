import { Container, Navbar as BootstrapNavbar, Nav } from "react-bootstrap";
import { Link } from "react-router-dom";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../../styles/navbar.css";  // Absolute path ensures correct resolution

const NavBarComponent = () => {
  return (
    <BootstrapNavbar expand="lg" className="custom-navbar bg-dark fixed-top">
      <Container className="d-flex align-items-center">
        {/* Left Side - Logo (50%) */}
        <div className="logo-container">
          <BootstrapNavbar.Brand as={Link} to="/" className="navbar-brand">
            <img
              src="/assets/logo.png"
              alt="Xigi Logo"
              className="navbar-logo"
            />
          </BootstrapNavbar.Brand>
        </div>

        {/* Navbar Toggle for Mobile */}
        <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" />

        {/* Right Side - Navigation (50%) */}
        <div className="nav-container">
          <BootstrapNavbar.Collapse id="basic-navbar-nav" className="justify-content-end">
            <Nav className="d-flex align-items-center">
              <Nav.Link as={Link} to="/contact" className="custom-nav-link text-white">Contact Us</Nav.Link>
            </Nav>
          </BootstrapNavbar.Collapse>
        </div>
      </Container>
    </BootstrapNavbar>
  );
};

export default NavBarComponent;

