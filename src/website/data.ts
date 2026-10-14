/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import {
  Snowflake,
  Lightbulb,
  ShieldCheck,
  HeartHandshake,
  Leaf,
  Truck,
  Radar,
  Cpu,
  Brain,
  Package,
  ThermometerSun,
  Route,
  Eye,
  Target,
  Gauge,
  MapPin,
  Phone,
  Mail,
  Clock,
  Linkedin,
  Facebook,
  Instagram,
  Twitter,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Leaf as LeafIcon,
  ShieldCheck as ShieldIcon,
  Zap,
  Network,
  Activity,
  Settings,
  Users,
  TrendingUp,
  Quote,
  Star,
} from 'lucide-react';

// The section links start with "/" so they also work from the Careers pages (REQ-HR-010), which are not on the home page.
export const NAV_LINKS = [
  { label: 'Home', href: '/#home' },
  { label: 'About', href: '/#about' },
  { label: 'Services', href: '/#services' },
  { label: 'Industries', href: '/#industries' },
  { label: 'Technology', href: '/#technology' },
  { label: 'Careers', href: '/careers' },
  { label: 'Track', href: '/track' }, // REQ-PRT-004 track a consignment by LR number
  { label: 'Contact', href: '/#contact' },
];

export const HERO_IMAGE = '/media/reftech_truck.jpeg';

export const HERO_IMAGE_2 = '/media/reftech_warehouse.jpeg';

export const ABOUT_IMAGE = '/media/industry-generated-3.jpg';

export const VISION_IMAGE = '/media/reftech_truck.jpeg';

export const MISSION_IMAGE = '/media/industry-generated-2.jpg';

export const INDUSTRY_IMAGE = '/media/industry-generated-4.jpg';

export const TECH_IMAGE = '/media/industry-generated-1.jpg';

export const CTA_IMAGE =
  '/media/reftech_warehouse.jpeg';

export const CORE_VALUES = [
  {
    icon: Lightbulb,
    title: 'Innovation',
    description: 'Embracing cutting-edge technologies to improve logistics solutions.',
  },
  {
    icon: ShieldCheck,
    title: 'Integrity',
    description: 'Upholding the highest standards in handling and transporting goods.',
  },
  {
    icon: HeartHandshake,
    title: 'Customer Satisfaction',
    description: 'Exceeding client expectations through exceptional service.',
  },
  {
    icon: Leaf,
    title: 'Sustainability',
    description: 'Promoting eco-friendly practices in all aspects of our operations.',
  },
];

export const DIFFERENTIATORS = [
  {
    icon: Gauge,
    title: 'Expertise in Reefer Logistics',
    description: 'Years of specialized experience in temperature-controlled transport.',
  },
  {
    icon: Cpu,
    title: 'Technology-Driven Solutions',
    description: 'IoT, AI, and real-time tracking integrated into every shipment.',
  },
  {
    icon: Package,
    title: 'End-to-End Service',
    description: 'Complete supply chain management from origin to destination.',
  },
  {
    icon: LeafIcon,
    title: 'Sustainability Focus',
    description: 'Eco-friendly practices that minimize environmental impact.',
  },
];

export const SERVICES = [
  {
    icon: ThermometerSun,
    title: 'Temperature-Controlled Logistics',
    description:
      'Delivering excellence in temperature-controlled logistics. We specialize in managing temperature-sensitive supply chains, ensuring your products remain fresh and secure throughout their journey.',
    features: [
      'Multi-zone temperature control',
      'Continuous cold chain integrity',
      'Compliance with GDP standards',
      'Real-time temperature logging',
    ],
  },
  {
    icon: Radar,
    title: 'Real-Time Visibility & Tracking',
    description:
      'Smart solutions for seamless cold chain management. We leverage advanced technologies to optimize supply chain efficiency, ensure reliability, and provide unmatched visibility.',
    features: [
      'Live GPS & temperature tracking',
      'Predictive ETA alerts',
      'Customizable notification thresholds',
      'Chain-of-custody documentation',
    ],
  },
  {
    icon: Network,
    title: 'End-to-End Supply Chain',
    description:
      'Seamless supply chain solutions, end-to-end. We provide comprehensive logistics solutions, managing every step of your supply chain for seamless and stress-free operations.',
    features: [
      'First-mile to last-mile coverage',
      'Cross-docking & warehousing',
      'Reverse logistics management',
      'Dedicated account management',
    ],
  },
  {
    icon: Leaf,
    title: 'Sustainable Cold Chain',
    description:
      'Sustainability at the core of our operations. We are committed to eco-friendly practices that minimize our environmental impact while delivering reliable logistics solutions.',
    features: [
      'Low-emission reefer fleet',
      'Route optimization for fuel savings',
      'Energy-efficient cold storage',
      'Carbon footprint reporting',
    ],
  },
];

export const INDUSTRIES = [
  {
    title: 'Food & Beverage',
    description: 'Ensuring freshness from farm to table.',
    image:
      '/media/industry-generated-2.jpg',
    temperature: '-18°C to +4°C',
  },
  {
    title: 'Pharmaceuticals',
    description: 'Maintaining the efficacy of temperature-sensitive medications.',
    image:
      '/media/industry-generated-1.jpg',
    temperature: '+2°C to +8°C',
  },
  {
    title: 'Agriculture',
    description: 'Preserving the quality of produce during transit.',
    image:
      '/media/industry-generated-3.jpg',
    temperature: '+2°C to +8°C',
  },
  {
    title: 'Floral Products',
    description: 'Delivering fresh flowers and plants with care.',
    image:
      '/media/industry-generated-4.jpg',
    temperature: '+2°C to +6°C',
  },
  {
    title: 'Dairy & Frozen Goods',
    description: 'Managing the complexities of cold storage and transportation.',
    image:
      '/media/reftech_warehouse.jpeg',
    temperature: '-25°C to +4°C',
  },
  {
    title: 'Seafood & Meat',
    description: 'Preserving freshness and quality from source to shelf.',
    image:
      '/media/reftech_truck.jpeg',
    temperature: '-2°C to +4°C',
  },
];

export const TECHNOLOGIES = [
  {
    icon: Radar,
    title: 'Real-Time Tracking',
    description:
      'Monitor your shipments with our advanced tracking systems that provide live updates and alerts.',
  },
  {
    icon: Cpu,
    title: 'IoT Integration',
    description:
      'Utilize smart sensors to track temperature, humidity, and other critical factors affecting your goods.',
  },
  {
    icon: Brain,
    title: 'Artificial Intelligence',
    description:
      'Leverage AI for predictive analytics to foresee potential disruptions and optimize routes.',
  },
];

export const PROCESS_STEPS = [
  {
    number: '01',
    icon: Eye,
    title: 'Consult & Plan',
    description:
      'We assess your cold chain requirements and design a tailored logistics strategy.',
  },
  {
    number: '02',
    icon: Package,
    title: 'Pack & Load',
    description:
      'Temperature-controlled packaging and loading with verified cold chain protocols.',
  },
  {
    number: '03',
    icon: Route,
    title: 'Transport & Monitor',
    description:
      'Real-time GPS and temperature monitoring throughout the entire journey.',
  },
  {
    number: '04',
    icon: CheckCircle2,
    title: 'Deliver & Verify',
    description:
      'On-time delivery with complete chain-of-custody documentation and quality checks.',
  },
];

export const FOOTER_LINKS = {
  Menu: [
    { label: 'Home', href: '/#home' },
    { label: 'About Us', href: '/#about' },
    { label: 'Services', href: '/#services' },
    { label: 'Industries', href: '/#industries' },
    { label: 'Technology', href: '/#technology' },
    { label: 'Careers', href: '/careers' },
    // REQ-PRT-004: public tracking, pickup / quote request and the locator
    { label: 'Track a Consignment', href: '/track' },
    { label: 'Request a Pickup', href: '/pickup' },
    { label: 'Get a Quote', href: '/pickup?kind=QUOTE' },
    { label: 'Our Locations', href: '/locations' },
    { label: 'Contact', href: '/#contact' },
  ],
  Services: [
    { label: 'Temperature-Controlled Logistics', href: '/#services' },
    { label: 'Real-Time Tracking', href: '/#technology' },
    { label: 'End-to-End Supply Chain', href: '/#services' },
    { label: 'Sustainable Cold Chain', href: '/#services' },
  ],
  Industries: [
    { label: 'Food & Beverage', href: '/#industries' },
    { label: 'Pharmaceuticals', href: '/#industries' },
    { label: 'Agriculture', href: '/#industries' },
    { label: 'Dairy & Frozen', href: '/#industries' },
  ],
};

export const ICONS = {
  Snowflake,
  ArrowRight,
  CheckCircle2,
  Star,
  Quote,
  Target,
  Eye,
  Zap,
  Settings,
  Users,
  TrendingUp,
  BarChart3,
  ShieldIcon,
  Activity,
  Truck,
  MapPin,
  Phone,
  Mail,
  Clock,
  Linkedin,
  Facebook,
  Instagram,
  Twitter,
};
