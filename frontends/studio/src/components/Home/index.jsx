import { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
    // Testimonials carousel state
    const testimonials = [
        {
            quote: "Setting up DOOH campaigns used to take days. With XIGI, it's minutes — and the results speak for themselves.",
            category: "Advertisers",
            role: "Global Media Buyer",
            image: "/assets/testimonial-advertiser.jpg"
        },
        {
            quote: "Our screens started earning more within the first month. The insights alone are worth joining the platform.",
            category: "Partners",
            role: "DOOH Network Owner",
            image: "/assets/testimonial-partner.jpg"
        },
        {
            quote: "The platform's intelligence layer has transformed our campaign performance. We're seeing better ROI across all locations.",
            category: "Advertisers",
            role: "Marketing Director",
            image: "/assets/testimonial-advertiser2.jpg"
        },
        {
            quote: "Automated scheduling and real-time monitoring have made managing our network effortless and profitable.",
            category: "Partners",
            role: "Network Operator",
            image: "/assets/testimonial-partner2.jpg"
        },
        {
            quote: "XIGI's data-driven approach helped us identify the best locations for our campaigns. Game changer!",
            category: "Advertisers",
            role: "Media Buyer",
            image: "/assets/testimonial-advertiser3.jpg"
        }
    ];

    const slidesToShow = 2;
    const totalSlides = Math.ceil(testimonials.length / slidesToShow);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlideIndex((prev) => (prev + 1) % totalSlides);
        }, 3000); // Auto-slide every 3 seconds

        return () => clearInterval(interval);
    }, [totalSlides]);

    const goToSlide = (slideIndex) => {
        setCurrentSlideIndex(slideIndex);
    };

    const getVisibleTestimonials = () => {
        // Show 2 testimonials for current slide
        const start = currentSlideIndex * slidesToShow;
        const result = [];
        for (let i = 0; i < slidesToShow; i++) {
            const index = (start + i) % testimonials.length;
            result.push(testimonials[index]);
        }
        return result;
    };

    return (
        <div className="home-page">
            {/* Hero Section */}
            <section className="hero-section">
                <Container className="d-flex flex-column h-100" style={{ minHeight: '90vh' }}>
                    <Row className="justify-content-center flex-grow-0">
                        <Col lg={12} className="text-center mb-5">
                            <h1 className="hero-heading mb-4">
                                Run outdoor campaigns and DOOH networks{' '}
                                <span className="hero-heading-gradient">on one smart platform</span>
                            </h1>
                            <p className="lead mb-4">
                                Plan, launch, optimise, and manage everything in one place — with intelligence that adapts to your goals.
                            </p>
                            <div className="d-flex gap-3 justify-content-center mb-4 flex-wrap flex-md-nowrap">
                                <Button as={Link} to="/login" variant="primary" size="lg" className="px-4 hero-button">
                                    Start a Campaign
                                </Button>
                                <Button as={Link} to="/login" variant="outline-primary" size="lg" className="px-4 hero-button-secondary">
                                    List Your Screens
                                </Button>
                            </div>
                            <Button as={Link} to="/contact" variant="link" className="text-decoration-none p-0 hero-button-link">
                                Talk to Sales →
                            </Button>
                        </Col>
                    </Row>
                    <Row className="flex-grow-1 d-flex align-items-end" style={{ marginBottom: 0 }}>
                        <Col lg={12} className="p-0" style={{ marginBottom: 0 }}>
                            <div className="hero-image text-center">
                                <img
                                    src="/assets/hero.png"
                                    alt="Dashboard"
                                    className="img-fluid"
                                    style={{ marginBottom: 0, display: 'block' }}
                                />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* What Is Xigi? Section */}
            <section className="what-is-section">
                <Container>
                    <Row className="justify-content-center align-items-center gx-5">
                        <Col lg={6} className="mb-4 mb-lg-0">
                            <h2 className="section-heading mb-4">What Is Xigi?</h2>
                            <p className="lead mb-4">
                                One platform that connects advertisers and media owners across the world, supported by real-world data, automation, and intelligent workflows.
                            </p>
                            <ul className="what-is-list">
                                <li className="sub-heading-text">
                                    <img src="/assets/Vector.png" alt="check" className="what-is-icon-img me-2" />
                                    A smarter way to run outdoor advertising
                                </li>
                                <li className="sub-heading-text">
                                    <img src="/assets/Vector.png" alt="check" className="what-is-icon-img me-2" />
                                    A smarter way to operate DOOH networks
                                </li>
                            </ul>
                        </Col>
                        <Col lg={6}>
                            <div className="what-is-illustration">
                                <img
                                    src="/assets/Xigi.png"
                                    alt="Xigi Platform Illustration"
                                    className="img-fluid"
                                />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Who Are You? Section */}
            <section className="who-are-you-section">
                <Container>
                    <h2 className="text-center section-heading mb-5">Who Are You?</h2>
                    <Row className="justify-content-center gx-5">
                        <Col lg={5} className="mb-4 mb-lg-0">
                            <Card className="h-100 shadow-sm who-are-you-card">
                                <Card.Body className="p-4">
                                    <h3 className="sub-heading mb-3">For Advertisers</h3>
                                    <p className="sub-heading-text mb-4" style={{ width: '80%' }}>
                                        Agencies, brand teams, media buyers, and business owners.
                                    </p>
                                    <div className="d-flex justify-content-between align-items-end">
                                        <Button as={Link} to="/login" variant="link" className="who-are-you-link p-0">
                                            Start a Campaign →
                                        </Button>
                                        <div className="who-are-you-icon">
                                            <img
                                                src="/assets/Advertise.png"
                                                alt="Advertisers Icon"
                                                className="who-are-you-icon-img"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'block';
                                                }}
                                            />
                                            <i className="bi bi-megaphone" style={{ display: 'none' }}></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col lg={5}>
                            <Card className="h-100 shadow-sm who-are-you-card">
                                <Card.Body className="p-4">
                                    <h3 className="sub-heading mb-3">For Media Owners</h3>
                                    <p className="sub-heading-text mb-4" style={{ width: '80%' }}>
                                        DOOH networks, LED screen owners, and operators.
                                    </p>
                                    <div className="d-flex justify-content-between align-items-end">
                                        <Button as={Link} to="/login" variant="link" className="who-are-you-link p-0">
                                            List Your Screens →
                                        </Button>
                                        <div className="who-are-you-icon">
                                            <img
                                                src="/assets/Media.png"
                                                alt="Media Owners Icon"
                                                className="who-are-you-icon-img"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'block';
                                                }}
                                            />
                                            <i className="bi bi-tv" style={{ display: 'none' }}></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* For Advertisers - What You Can Do */}
            <section className="advertisers-section">
                <Container>
                    <h2 className="section-heading mb-5 text-center">For Advertisers - What You Can Do</h2>
                    <Row className="mb-5">
                        <Col lg={7} className="mb-4 mb-lg-0">
                            <div className="advertisers-cta-card">
                                <h3 className="sub-heading-1 mb-3">Launch outdoor campaigns in minutes</h3>
                                <p className="lead mb-4">
                                    Set up your full campaign through a simple conversation. No learning curve. No manual planning.
                                </p>
                                <Button as={Link} to="/login" variant="primary" className="advertisers-cta-button px-4 w-auto">
                                    Start a Campaign
                                </Button>
                            </div>
                        </Col>
                        <Col lg={5}>
                            <div className="image-placeholder h-100">
                                <div className="placeholder-content">Image Placeholder</div>
                            </div>
                        </Col>
                    </Row>
                    <Row className="mt-5" style={{ border: '1px solid #00000020', borderRadius: '12px', backgroundColor: '#fff' }}>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Advertise-1.png" alt="Plan smarter" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Plan smarter with real-world data</h5>
                                    <p className="sub-heading-text mb-0">
                                        XIGI suggests the right screens based on relevance, location patterns, audience metadata, past performance indicators.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Advertise-2.png" alt="Programmatic ready" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Programmatic ready buying</h5>
                                    <p className="sub-heading-text mb-0">
                                        Automated screen selection, budget allocation, and optimal delivery for multi-city or multi-network campaigns.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Advertise-3.png" alt="Validate creatives" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Validate creatives instantly</h5>
                                    <p className="sub-heading-text mb-0">
                                        XIGI checks specs, format, policies, readability, and content suitability before going live.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Advertise-4.png" alt="Make creatives stronger" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Make your creatives stronger</h5>
                                    <p className="sub-heading-text mb-0">
                                        Get guidance on headlines, layout, tone, and structure for higher impact.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Advertise-5.png" alt="Track performance" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Track performance with clarity</h5>
                                    <p className="sub-heading-text mb-0">
                                        Live campaign data — dwell time, footfall trends, audience patterns, delivery accuracy, and real-world insights.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Advertise-6.png" alt="Next-step recommendations" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Get next-step recommendations</h5>
                                    <p className="sub-heading-text mb-0">
                                        What to adjust. What to try next. What worked. Clear suggestions that improve ROI over time.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* The Intelligence Layer */}
            <section className="intelligence-section">
                <Container>
                    <h2 className="text-center section-heading  mb-5">The Intelligence Layer</h2>
                    <Row className="align-items-center">
                        <Col lg={3} className="p-3">
                            <h3 className="sub-heading intelligence-heading mb-4">Learn From</h3>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-1.png" alt="Location patterns" className="intelligence-item-icon" />
                                    <span>Location patterns</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-2.png" alt="Screen performance" className="intelligence-item-icon" />
                                    <span>Screen performance</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-3.png" alt="Campaign outcomes" className="intelligence-item-icon" />
                                    <span>Campaign outcomes</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-4.png" alt="Audience metadata" className="intelligence-item-icon" />
                                    <span>Audience metadata</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-5.png" alt="Seasonal behaviour" className="intelligence-item-icon" />
                                    <span>Seasonal behaviour</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-6.png" alt="Time-based behaviour" className="intelligence-item-icon" />
                                    <span>Time-based behaviour</span>
                                </div>
                            </div>
                        </Col>
                        <Col lg={6} className="text-center p-3">
                            <div className="intelligence-dashboard">
                                <div className="play-button">
                                    <i className="bi bi-play-fill"></i>
                                </div>
                            </div>
                        </Col>
                        <Col lg={3}>
                            <h3 className="sub-heading intelligence-heading mb-4">Help you</h3>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-1.png" alt="Choose better locations" className="intelligence-item-icon" />
                                    <span>Choose better locations</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-2.png" alt="Improve delivery" className="intelligence-item-icon" />
                                    <span>Improve delivery</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-3.png" alt="Strengthen creative" className="intelligence-item-icon" />
                                    <span>Strengthen creative</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-4.png" alt="Increase earnings" className="intelligence-item-icon" />
                                    <span>Increase earnings</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-5.png" alt="Optimise budgets" className="intelligence-item-icon" />
                                    <span>Optimise budgets</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="intelligence-item-box">
                                    <img src="/assets/Learn-6.png" alt="Forecast performance" className="intelligence-item-icon" />
                                    <span>Forecast performance</span>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* For Media Owners - What You Can Do */}
            <section className="media-owners-section">
                <Container>
                    <h2 className="section-heading mb-5 text-center">For Media Owners - What You Can do</h2>
                    <Row className="mb-5">
                        <Col lg={7} className="mb-4 mb-lg-0">
                            <div className="advertisers-cta-card">
                                <h3 className="sub-heading-1 mb-3">Earn more from every screen</h3>
                                <p className="lead mb-4">
                                    Connect to global advertisers and drive higher fill rates.
                                </p>
                                <Button as={Link} to="/login" variant="primary" className="advertisers-cta-button px-4 w-auto">
                                    List Your Screens →
                                </Button>
                            </div>
                        </Col>
                        <Col lg={5}>
                            <div className="image-placeholder h-100">
                                <div className="placeholder-content">Image Placeholder</div>
                            </div>
                        </Col>
                    </Row>
                    <Row className="mt-5" style={{ border: '1px solid #00000020', borderRadius: '12px', backgroundColor: '#fff' }}>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Media-1.png" alt="Control your entire network" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Control your entire network</h5>
                                    <p className="sub-heading-text mb-0">
                                        Manage screens, inventory, pricing, and slots in one dashboard.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Media-1.png" alt="Smarter optimisation suggestions" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Smarter optimisation suggestions</h5>
                                    <p className="sub-heading-text mb-0">
                                        System intelligence highlights underperforming screens, high-value locations, and opportunities to increase revenue.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Media-3.png" alt="Monitor uptime and performance" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Monitor uptime and performance</h5>
                                    <p className="sub-heading-text mb-0">
                                        Live screen health, playback status, brightness levels, and last-seen logs.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Media-5.png" alt="Automated scheduling" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Automated scheduling</h5>
                                    <p className="sub-heading-text mb-0">
                                        Reduce manual work with automated content delivery and structured workflows.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Media-6.png" alt="Transparent earnings" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Transparent earnings</h5>
                                    <p className="sub-heading-text mb-0">
                                        Track revenue, settlements, and campaign delivery with full visibility.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-4 advertisers-feature-col p-3">
                            <Card className="h-100 advertisers-feature-card">
                                <Card.Body className="p-4">
                                    <div className="feature-icon advertisers-feature-icon mb-4">
                                        <img src="/assets/Media-6.png" alt="Grow globally" className="advertisers-icon-img" />
                                    </div>
                                    <h5 className="sub-heading mb-3" style={{ width: '70%' }}>Grow globally</h5>
                                    <p className="sub-heading-text mb-0">
                                        Your screens become discoverable to agencies and brands across regions.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Programmatic DOOH Section */}
            <section className="programmatic-section">
                <Container>
                    <div className="programmatic-container" style={{ backgroundImage: `url(/assets/Program.png)` }}>
                        <Row className="align-items-center">
                            <Col lg={8}>
                                <h2 className="programmatic-title section-heading mb-3">Programmatic DOOH The Next Step</h2>
                                <p className="programmatic-subtitle lead mb-4" style={{ color: '#fff' }}>XIGI simplifies what's traditionally complex:</p>
                                <div className="programmatic-features">
                                    <div className="programmatic-features-row mb-3">
                                        <div className="programmatic-feature-badge me-3">
                                            <i className="bi bi-star programmatic-icon"></i>
                                            <span>Automated buying and selling</span>
                                        </div>
                                        <div className="programmatic-feature-badge">
                                            <i className="bi bi-truck programmatic-icon"></i>
                                            <span>Intelligent pacing and delivery</span>
                                        </div>
                                    </div>
                                    <div className="programmatic-features-row mb-3">
                                        <div className="programmatic-feature-badge me-3">
                                            <i className="bi bi-building programmatic-icon"></i>
                                            <span>Smart budget allocation</span>
                                        </div>
                                        <div className="programmatic-feature-badge">
                                            <i className="bi bi-search programmatic-icon"></i>
                                            <span>Cross-network visibility</span>
                                        </div>
                                    </div>
                                    <div className="programmatic-features-row">
                                        <div className="programmatic-feature-badge">
                                            <i className="bi bi-arrows-collapse programmatic-icon"></i>
                                            <span>Real-time flexibility</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="programmatic-conclusion" >
                                    Whether you are an advertiser or a media owner you stay in control, with clarity.
                                </p>
                            </Col>
                            <Col lg={6}></Col>
                        </Row>
                    </div>
                </Container>
            </section>

            {/* Platform Snapshot */}
            <section className="snapshot-section" >
                <Container style={{ width: '70%' }}>
                    <h2 className="text-center section-heading mb-5">Platform Snapshot</h2>
                    {/* 6 Grid Boxes - Like Advertisers Section */}
                    <Row className="mt-5" style={{ border: '1px solid #00000020', borderRadius: '12px', backgroundColor: '#fff' }}>
                        <Col md={4} className="mb-4 snapshot-feature-col p-3">
                            <div className="h-100 snapshot-feature-box">
                                <div className="snapshot-item">
                                    <img
                                        src="/assets/Snapshot-1.png"
                                        alt="Dashboard View"
                                        className="img-fluid"
                                    />
                                </div>
                            </div>
                        </Col>
                        <Col md={4} className="mb-4 snapshot-feature-col p-3">
                            <div className="h-100 snapshot-feature-box">
                                <div className="snapshot-item">
                                    <img
                                        src="/assets/Snapshot-2.png"
                                        alt="Campaign Planning"
                                        className="img-fluid"
                                    />
                                </div>
                            </div>
                        </Col>
                        <Col md={4} className="mb-4 snapshot-feature-col p-3">
                            <div className="h-100 snapshot-feature-box">
                                <div className="snapshot-item">
                                    <img
                                        src="/assets/Snapshot-3.png"
                                        alt="Performance Overview"
                                        className="img-fluid"
                                    />
                                </div>
                            </div>
                        </Col>
                        <Col md={4} className="mb-4 snapshot-feature-col p-3">
                            <div className="h-100 snapshot-feature-box">
                                <div className="snapshot-item">
                                    <img
                                        src="/assets/Snapshot-4.png"
                                        alt="Analytics"
                                        className="img-fluid"
                                    />
                                </div>
                            </div>
                        </Col>
                        <Col md={4} className="mb-4 snapshot-feature-col p-3">
                            <div className="h-100 snapshot-feature-box">
                                <div className="snapshot-item">
                                    <img
                                        src="/assets/Snapshot-5.png"
                                        alt="Project Management"
                                        className="img-fluid"
                                    />
                                </div>
                            </div>
                        </Col>
                        <Col md={4} className="mb-4 snapshot-feature-col p-3">
                            <div className="h-100 snapshot-feature-box">
                                <div className="snapshot-item">
                                    <img
                                        src="/assets/Snapshot-6.png"
                                        alt="Cashback & Analytics"
                                        className="img-fluid"
                                    />
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Use Case Section */}
            <section className="use-case-section">
                <Container>
                    <h2 className="text-center section-heading mb-5">Use Case</h2>
                    <Row>
                        <Col lg={6} className="mb-4 mb-lg-0">
                            <Card className="h-100 use-case-card">
                                <div className="use-case-screenshot">
                                    <img
                                        src="/assets/Case-1.png"
                                        alt="Advertisers Dashboard"
                                        className="img-fluid"
                                    />
                                </div>
                                <Card.Body className="use-case-card-body">
                                    <h3 className="sub-heading use-case-title">For Advertisers</h3>
                                    <ul className="use-case-list">
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Launch a 10-city campaign without calling a single vendor
                                        </li>
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Compare locations with real-world data
                                        </li>
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Improve creative impact before running the ad
                                        </li>
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Track performance in one dashboard
                                        </li>
                                    </ul>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col lg={6}>
                            <Card className="h-100 use-case-card">
                                <div className="use-case-screenshot">
                                    <img
                                        src="/assets/case-2.png"
                                        alt="Partners Dashboard"
                                        className="img-fluid"
                                    />
                                </div>
                                <Card.Body className="use-case-card-body">
                                    <h3 className="sub-heading use-case-title">For Partners</h3>
                                    <ul className="use-case-list">
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Sell unused inventory automatically
                                        </li>
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Identify high-value time slots
                                        </li>
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Keep screens healthy and compliant
                                        </li>
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Increase revenue per screen
                                        </li>
                                        <li>
                                            <img src="/assets/Vector.png" alt="check" className="use-case-icon-img me-3" />
                                            Get discovered by global brands
                                        </li>
                                    </ul>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Call to Action Section */}
            <section className="cta-section">
                <Container>
                    <div className="cta-container mx-auto">
                        <Row className="g-0">
                            <Col lg={6}>
                                <div className="cta-half cta-left">
                                    <p className="cta-category">Advertisers</p>
                                    <h3 className="cta-heading">Start a Campaign</h3>
                                    <p className="lead">Plan smarter. Launch faster.</p>
                                    <Button as={Link} to="/login" className="cta-button-solid">
                                        Start a Campaign
                                    </Button>
                                </div>
                            </Col>
                            <div className="cta-divider-container">
                                <div className="cta-divider-line"></div>
                            </div>
                            <div className="cta-divider-mobile">
                                <div className="cta-divider-line-mobile"></div>
                            </div>
                            <Col lg={6}>
                                <div className="cta-half cta-right">
                                    <p className="cta-category">Media Owners</p>
                                    <h3 className="cta-heading">List Your Screens</h3>
                                    <p className="lead">Earn more from every location.</p>
                                    <Button as={Link} to="/login" className="cta-button-outline">
                                        List Your Screens
                                    </Button>
                                </div>
                            </Col>
                        </Row>
                    </div>
                    <div className="text-center mt-4">
                        <Button as={Link} to="/contact" variant="link" className="cta-sales-link">
                            Talk to Sales →
                        </Button>
                    </div>
                </Container>
            </section>

            {/* Testimonials Section */}
            <section className="testimonials-section">
                <Container>
                    <Row className="justify-content-center align-items-center">
                        <Col lg={4} className="mb-4 mb-lg-0">
                            <h2 className="section-heading testimonials-heading">Testimonials</h2>
                            <p className="lead">(Advertisers & Partners)</p>
                        </Col>
                        <Col lg={8}>
                            <div className="testimonials-carousel">
                                <div className="testimonials-cards-wrapper">
                                    <Row className="g-4">
                                        {getVisibleTestimonials().map((testimonial, index) => (
                                            <Col md={6} key={index}>
                                                <Card className="testimonial-card">
                                                    <Card.Body className="testimonial-card-body">
                                                        <p className="lead testimonial-quote">"{testimonial.quote}"</p>
                                                        <div className="testimonial-author">
                                                            <div className="testimonial-avatar">
                                                                <img
                                                                    src={testimonial.image}
                                                                    alt={testimonial.role}
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                                <div className="testimonial-avatar-placeholder" style={{ display: 'none' }}>
                                                                    <i className="bi bi-person"></i>
                                                                </div>
                                                            </div>
                                                            <div className="testimonial-info">
                                                                <p className="testimonial-category">{testimonial.category}</p>
                                                                <p className="testimonial-role">{testimonial.role}</p>
                                                            </div>
                                                        </div>
                                                    </Card.Body>
                                                </Card>
                                            </Col>
                                        ))}
                                    </Row>
                                </div>
                                <div className="testimonials-pagination">
                                    {Array.from({ length: totalSlides }).map((_, slideIndex) => (
                                        <button
                                            key={slideIndex}
                                            className={`testimonial-dot ${slideIndex === currentSlideIndex ? 'active' : ''}`}
                                            onClick={() => goToSlide(slideIndex)}
                                            aria-label={`Go to slide ${slideIndex + 1}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
        </div>
    );
}

export default Home;
