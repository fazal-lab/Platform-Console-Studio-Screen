import React, { useState } from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import './Contact.css';

const Contact = () => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        message: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        alert('Message sent successfully!');
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="contact-page-refined">
            <Container>
                <Row className="align-items-center justify-content-center min-vh-75">
                    {/* Left Side: Contact Info */}
                    <Col lg={4} className="mb-5 mb-lg-0">
                        <div className="contact-info-refined">
                            <h1 className="get-in-touch-title mb-5">Get In Touch</h1>

                            <div className="info-block-refined d-flex align-items-start mb-4">
                                <div className="info-icon-box">
                                    <i className="bi bi-telephone"></i>
                                </div>
                                <div>
                                    <h4 className="info-label-refined">Phone Number</h4>
                                    <p className="info-value-refined">+91 7358016708</p>
                                </div>
                            </div>

                            <div className="info-block-refined d-flex align-items-start">
                                <div className="info-icon-box">
                                    <i className="bi bi-envelope"></i>
                                </div>
                                <div>
                                    <h4 className="info-label-refined">E-Mail</h4>
                                    <p className="info-value-refined">hello@xigi.com</p>
                                </div>
                            </div>
                        </div>
                    </Col>

                    {/* Right Side: Form Card */}
                    <Col lg={6}>
                        <div className="contact-form-card-refined shadow-sm p-4 p-md-5">
                            <h2 className="send-message-title mb-4">Send a message</h2>
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-4">
                                    <Form.Label className="refined-field-label">Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="name"
                                        placeholder="Enter the Name"
                                        className="refined-input-borderless"
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>

                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="refined-field-label">Phone</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="phone"
                                                placeholder="Phone"
                                                className="refined-input-borderless"
                                                onChange={handleChange}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="refined-field-label">E-mail</Form.Label>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                placeholder="Enter the Mail"
                                                className="refined-input-borderless"
                                                onChange={handleChange}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Form.Group className="mb-4">
                                    <Form.Label className="refined-field-label">Message</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        name="message"
                                        placeholder="Message"
                                        className="refined-input-borderless"
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>

                                <div className="text-end">
                                    <Button type="submit" className="refined-submit-btn px-5 py-2">
                                        Submit
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Contact;
