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
  Boxes,
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

export const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Industries', href: '#industries' },
  { label: 'Technology', href: '#technology' },
  { label: 'Contact', href: '#contact' },
];

export const HERO_IMAGE = '/media/reftech_truck.jpeg';

export const HERO_IMAGE_2 = '/media/reftech_warehouse.jpeg';

export const ABOUT_IMAGE = '/media/reftech_warehouse.jpeg';

export const VISION_IMAGE =
  'https://images.pexels.com/photos/38927007/pexels-photo-38927007.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop';

export const MISSION_IMAGE =
  'https://images.pexels.com/photos/4487383/pexels-photo-4487383.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop';

export const INDUSTRY_IMAGE =
  'https://images.pexels.com/photos/1267327/pexels-photo-1267327.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop';

export const TECH_IMAGE =
  'https://images.pexels.com/photos/12969403/pexels-photo-12969403.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop';

export const CTA_IMAGE =
  'https://images.pexels.com/photos/38779041/pexels-photo-38779041.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop';

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
      'https://images.pexels.com/photos/12519455/pexels-photo-12519455.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    temperature: '-18°C to +4°C',
  },
  {
    title: 'Pharmaceuticals',
    description: 'Maintaining the efficacy of temperature-sensitive medications.',
    image:
      'https://images.pexels.com/photos/7615415/pexels-photo-7615415.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    temperature: '+2°C to +8°C',
  },
  {
    title: 'Agriculture',
    description: 'Preserving the quality of produce during transit.',
    image:
      'https://images.pexels.com/photos/31834232/pexels-photo-31834232.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    temperature: '+2°C to +8°C',
  },
  {
    title: 'Floral Products',
    description: 'Delivering fresh flowers and plants with care.',
    image:
      'https://images.pexels.com/photos/8931670/pexels-photo-8931670.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    temperature: '+2°C to +6°C',
  },
  {
    title: 'Dairy & Frozen Goods',
    description: 'Managing the complexities of cold storage and transportation.',
    image:
      'https://images.pexels.com/photos/4725704/pexels-photo-4725704.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    temperature: '-25°C to +4°C',
  },
  {
    title: 'Seafood & Meat',
    description: 'Preserving freshness and quality from source to shelf.',
    image:
      'https://images.pexels.com/photos/1656663/pexels-photo-1656663.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
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

export const STATS = [
  { value: 99.8, suffix: '%', label: 'On-Time Delivery', icon: Clock },
  { value: 500, suffix: '+', label: 'Shipments Monthly', icon: Truck },
  { value: 24, suffix: '/7', label: 'Monitoring & Support', icon: Activity },
  { value: 50, suffix: '+', label: 'Cities Served', icon: MapPin },
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

export const TESTIMONIALS = [
  {
    quote:
      'Reftech transformed our cold chain operations. Their real-time tracking and temperature monitoring gave us complete peace of mind across every shipment.',
    author: 'Rajesh Kumar',
    role: 'Supply Chain Director, FreshFoods India',
    rating: 5,
  },
  {
    quote:
      'The 5PL approach means we never have to worry about logistics. Reftech handles everything end-to-end with remarkable precision and transparency.',
    author: 'Dr. Priya Sharma',
    role: 'Head of Logistics, PharmaCorp',
    rating: 5,
  },
  {
    quote:
      'Their commitment to sustainability and technology sets them apart. We have reduced our logistics costs while improving delivery reliability.',
    author: 'Amit Patel',
    role: 'Operations Manager, AgriFresh',
    rating: 5,
  },
];

export const CONTACT_INFO = [
  { icon: MapPin, label: 'Office', value: 'Reftech SCS 5PL Private Limited, India' },
  { icon: Phone, label: 'Phone', value: '+91 98765 43210' },
  { icon: Mail, label: 'Email', value: 'info@reftech.in' },
  { icon: Clock, label: 'Hours', value: '24/7 Operations & Support' },
];

export const SOCIAL_LINKS = [
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Twitter, href: '#', label: 'Twitter' },
];

export const FOOTER_LINKS = {
  Menu: [
    { label: 'Home', href: '#home' },
    { label: 'About Us', href: '#about' },
    { label: 'Services', href: '#services' },
    { label: 'Industries', href: '#industries' },
    { label: 'Technology', href: '#technology' },
    { label: 'Contact', href: '#contact' },
  ],
  Services: [
    { label: 'Temperature-Controlled Logistics', href: '#services' },
    { label: 'Real-Time Tracking', href: '#technology' },
    { label: 'End-to-End Supply Chain', href: '#services' },
    { label: 'Sustainable Cold Chain', href: '#services' },
  ],
  Industries: [
    { label: 'Food & Beverage', href: '#industries' },
    { label: 'Pharmaceuticals', href: '#industries' },
    { label: 'Agriculture', href: '#industries' },
    { label: 'Dairy & Frozen', href: '#industries' },
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
