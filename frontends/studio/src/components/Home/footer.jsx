import { Container, Row, Col } from "react-bootstrap";
import "../../styles/footer.css";

const FooterSection = () => {
    return (
        <footer className="footer-section px-5">
            <Container fluid>
                <div className="footer-content">
                    <Row>
                        <Col lg={3} className="mb-4 mb-lg-0">
                            <div className="footer-brand">
                                <h2 className="footer-logo">xigi</h2>
                                <p className="footer-tagline">
                                    Maximize DOOH revenue with automation and intelligence.
                                </p>
                                <div className="footer-copyright d-none d-lg-block">
                                    Copyright © 2024. XIGI Tech Pvt Ltd.<br />All Rights Reserved.
                                </div>
                            </div>
                        </Col>
                        <Col lg={3} md={4} sm={6} className="mb-4">
                            <h5 className="footer-heading">Multi-Media</h5>
                            <ul className="footer-links">
                                <li><a href="#">DOOH Screens</a></li>
                                <li><a href="#">Billboards</a></li>
                                <li><a href="#">Transit Media</a></li>
                                <li><a href="#">Retail Screens</a></li>
                                <li><a href="#">Street Furniture</a></li>
                            </ul>
                        </Col>

                        <Col lg={3} md={4} sm={6} className="mb-4">
                            <h5 className="footer-heading">Company</h5>
                            <ul className="footer-links">
                                <li><a href="#">About Us</a></li>
                                <li><a href="#">Careers</a></li>
                                <li><a href="#">Blog</a></li>
                                <li><a href="#">Press</a></li>
                            </ul>
                        </Col>

                        <Col lg={3} md={4} sm={6}>
                            <h5 className="footer-heading">Contact Us</h5>
                            <ul className="footer-links">
                                <li><a href="#">Email</a></li>
                                <li><a href="#">Linkedln</a></li>
                                <li><a href="#">Twitter</a></li>
                                <li><a href="#">Facebook</a></li>
                            </ul>
                        </Col>
                    </Row>

                    <div className="footer-copyright d-lg-none mt-4">
                        Copyright © 2024. XIGI Tech Pvt Ltd. All Rights Reserved.
                    </div>
                </div>

                <div className="footer-bottom-links text-center mt-5" style={{ fontSize: '12px', color: '#666' }}>
                    <a href="#" style={{ color: '#666', marginRight: '20px' }}>Privacy Policy</a>
                    <a href="#" style={{ color: '#666' }}>Terms of Use</a>
                </div>
            </Container>
        </footer>
    );
};

export default FooterSection;
