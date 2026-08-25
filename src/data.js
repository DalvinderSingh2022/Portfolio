// Central content source for the portfolio.
// Edit here to update the site — components read everything from this file.

export const profile = {
  name: "Dalvinder Singh",
  role: "Full Stack Developer",
  tagline: "MERN Stack · Real-time Web Apps",
  location: "New Delhi, India",
  avatar: "/profile.jpeg",
  email: "dalvindersingh201999@gmail.com",
  phone: "+91 8447421200",
  resume: "/Dalvinder_Singh_Resume.pdf",
  summary:
    "Computer Science graduate and Full Stack Developer with a strong foundation in building scalable, user-focused web applications. I work across the MERN stack — turning ideas into responsive, real-time products — and I love sharpening my problem-solving through Data Structures & Algorithms.",
  roles: [
    "Full Stack Developer",
    "React Engineer",
    "MERN Developer",
    "Problem Solver",
  ],
};

export const socials = {
  github: "https://github.com/DalvinderSingh2022",
  linkedin: "https://www.linkedin.com/in/dalvindersingh2019/",
  email: "mailto:dalvindersingh201999@gmail.com",
};

export const stats = [
  { value: "9.2", label: "CGPA / 10" },
  { value: "17+", label: "Projects Shipped" },
  { value: "1.5+", label: "Years Building" },
];

export const skills = [
  {
    group: "Languages",
    items: ["C++", "JavaScript (ES6+)", "HTML5", "CSS3"],
  },
  {
    group: "Frontend",
    items: ["React.js", "Redux", "Tailwind CSS", "Responsive UI"],
  },
  {
    group: "Backend",
    items: ["Node.js", "Express.js", "MongoDB", "REST API", "Socket.io", "JWT"],
  },
  {
    group: "Core & Tools",
    items: ["Git", "Data Structures & Algorithms", "OOP", "Agile"],
  },
];

export const projects = [
  {
    title: "Draw n Guess",
    blurb:
      "A real-time, multiplayer drawing & guessing game (think Pictionary) with a synchronized canvas, live chat and low-latency player interaction over WebSockets.",
    tags: ["React", "Node.js", "Express", "Socket.io"],
    live: "https://drawnguessds.netlify.app/",
    code: "https://github.com/DalvinderSingh2022/Draw-n-Guess",
    featured: true,
    highlight: "Real-time",
  },
  {
    title: "Real-Time Task Manager",
    blurb:
      "A full MERN task-management system with JWT-secured routes and real-time state synchronization, so task updates appear instantly across every connected client.",
    tags: ["MongoDB", "Express", "React", "Node.js", "JWT", "WebSockets"],
    live: "https://taskmanagerrt.netlify.app",
    code: "https://github.com/DalvinderSingh2022/Real-Time-Task-Management",
    featured: true,
    highlight: "MERN + Auth",
  },
  {
    title: "Crypto",
    blurb:
      "A platform for exploring and sharing cryptocurrency content — live market data, clean cards and a fast, filterable browsing experience.",
    tags: ["React", "REST API", "Tailwind CSS"],
    live: "https://cryptocoinsds.netlify.app/",
    code: "https://github.com/DalvinderSingh2022/Crypto",
    featured: true,
    highlight: "Live data",
  },
  {
    title: "GitHub Profile Viewer",
    blurb:
      "A tool that fetches and visualizes any developer's GitHub data — repository stats, languages and profile insights — powered by the GitHub REST API.",
    tags: ["JavaScript", "GitHub REST API", "HTML", "CSS"],
    live: "https://githubprofileds.netlify.app/",
    code: "https://github.com/DalvinderSingh2022/GitHub-Profile",
    featured: false,
    highlight: "API",
  },
  {
    title: "Tasker",
    blurb:
      "A simple yet powerful to-do application to organize daily work — quick capture, status tracking and a clean, distraction-free interface.",
    tags: ["React", "JavaScript", "CSS"],
    live: "https://todoappds.netlify.app/",
    code: "https://github.com/DalvinderSingh2022/Tasker",
    featured: false,
    highlight: "Productivity",
  },
  {
    title: "IPL 2023 Stats",
    blurb:
      "A statistics dashboard for IPL 2023 — team and player numbers presented through readable tables and visual breakdowns.",
    tags: ["JavaScript", "Data Viz", "HTML", "CSS"],
    live: "https://iplstatsds.netlify.app/",
    code: "https://github.com/DalvinderSingh2022/IPL2023",
    featured: false,
    highlight: "Dashboard",
  },
];

export const moreProjects = [
  { name: "Weather App", live: "https://weatherds.netlify.app/" },
  { name: "JumpBall (2D game)", live: "https://jumpballds.netlify.app/" },
  { name: "E-commerce Demo", live: "https://ecommerceds.netlify.app/" },
  { name: "Food Finder", live: "https://main--findfoodds.netlify.app/" },
];

export const experience = [
  {
    role: "Full Stack Developer",
    company: "Odisoft Technology",
    period: "Feb 2025 — Present",
    current: true,
    points: [
      "Architect and build front-end features for high-priority web and mobile applications using React.",
      "Improved application load times and UI performance for a seamless, consistent experience across platforms.",
      "Collaborate in an agile team, pivoting between project phases to meet critical deadlines.",
    ],
  },
  {
    role: "Web Developer Intern",
    company: "Hirers.co.in",
    period: "Jan 2024 — Feb 2024",
    current: false,
    points: [
      "Led a front-end redesign initiative that significantly enhanced the visual appeal and overall UX.",
      "Engineered responsive layouts with modern CSS, ensuring 100% cross-device compatibility.",
    ],
  },
];

export const education = [
  {
    degree: "B.Tech, Computer Science",
    school: "Guru Tegh Bahadur Institute of Technology",
    period: "Aug 2021 — Sep 2025",
    detail: "CGPA 9.2 / 10",
  },
  {
    degree: "Senior Secondary (XII), CBSE",
    school: "CBSE Board",
    period: "May 2021",
    detail: "83.66%",
  },
];
