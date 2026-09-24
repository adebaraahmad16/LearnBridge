# LearnBridge

## Amule Government Secondary School

LearnBridge is Amule Government Secondary School's digital learning platform designed to give students free access to approved, curriculum-relevant educational resources. Rather than functioning as a simple collection of PDFs and videos, it combines a digital resource library with learning activities, quizzes, assignments, progress tracking, and school-level management.

The goal is to give every student access to quality learning support regardless of whether they can afford private tutoring or additional learning materials.

---

## Problem Statement

Many students face barriers that affect their learning, including:

- Limited access to private tutoring
- Lack of textbooks and learning materials
- Missing lessons because of illness or absence
- Difficulty understanding topics after classroom teaching
- Challenges preparing for examinations
- Difficulty identifying reliable online educational resources
- Lack of revision materials outside school hours

LearnBridge gives students access to a common, organized, and school-approved collection of learning resources.

---

## Main Objectives

- Provide free educational resources to students.
- Allow schools to control and approve learning materials.
- Give teachers tools to upload resources for their classes.
- Organize resources by class, subject, topic, and resource type.
- Support learning through notes, videos, worksheets, quizzes, and assignments.
- Track student learning progress.
- Help teachers identify students who need additional support.
- Provide school administrators with learning analytics.
- Support Nigerian school levels and curriculum structures.
- Keep the platform lightweight and suitable for low-data environments.

---

# User Roles

The platform has four main user roles.

## 1. School Administrator

The school administrator controls the Learning Hub.

### Responsibilities

- Create learning categories
- Add and manage subjects
- Manage classes
- Approve teacher-uploaded resources
- Upload school-wide resources
- Manage resource visibility
- Monitor resource usage
- View learning analytics
- Identify subjects where students are struggling
- Remove outdated resources
- Manage teacher permissions
- Manage school settings

### Admin Dashboard

The administrator dashboard can contain:

- Total students
- Total teachers
- Total resources
- Active students
- Lessons completed
- Quizzes taken
- Most popular subjects
- Most accessed topics
- Classes or subjects requiring additional support
- Pending resources awaiting approval

---

## 2. Teacher

Teachers can provide additional learning resources for their students.

### Teachers Can

- View assigned classes
- Upload learning resources
- Create assignments
- Create quizzes
- View student progress
- Monitor resource usage
- Recommend resources
- Manage resources they have uploaded

### Resource Visibility

Teachers can choose:

- **My Class** — visible only to their class
- **Selected Classes** — visible to selected classes
- **Entire School** — available to relevant students across the school

### Teacher Resource Upload

The upload form should contain:

- Resource Title
- Subject
- Class
- Topic
- Resource Type
- Description
- File Upload
- Optional Thumbnail
- Visibility
- Submit for Approval

---

## 3. Student

Students have a simple dashboard focused on learning.

### Student Dashboard

Possible sections include:

- Welcome message
- Continue Learning
- My Subjects
- Recommended Resources
- Recent Resources
- Assignments
- Quizzes
- My Progress
- Exam Preparation
- Achievements

Students should only see resources relevant to their school, class, and enrolled subjects.

### Example

**Continue Learning**

- Mathematics — Algebraic Expressions — 65%
- Basic Science — Photosynthesis — 40%
- English — Parts of Speech — 80%

---

## 4. Parent

Parents do not need to upload resources. Their role is mainly monitoring.

### Parent Features

Parents can view:

- Child's learning activity
- Resources accessed
- Assignments completed
- Quizzes taken
- Quiz scores
- Learning progress
- Subjects requiring attention
- Results

---

# Digital Learning Library

The Digital Library is the core feature of the platform.

Resources should follow this structure:

**Class → Subject → Topic → Resource**

### Example

`JSS 1 → Mathematics → Fractions → Adding Fractions`

### Supported Resource Types

- Notes
- E-books
- Videos
- Audio lessons
- Worksheets
- Presentations
- External learning resources
- Revision materials
- Practice questions
- Quizzes

---

# Curriculum-Based Resources

The platform should support resources organized according to school levels.

## Junior Secondary School

- Mathematics
- English
- Basic Science
- Basic Technology
- Business Studies
- Computer Studies
- Civic Education
- Social Studies

## Senior Secondary School

- Mathematics
- English
- Biology
- Chemistry
- Physics
- Economics
- Government
- Literature
- Geography
- Agricultural Science
- Computer Science

---

# Search and Filtering

Students should be able to quickly find resources.

### Search

A search field such as:

`Search for a topic...`

### Filters

Students can filter by:

- Class
- Subject
- Topic
- Resource Type
- Difficulty

### Difficulty Levels

- Beginner
- Intermediate
- Advanced

### Resource Types

- Video
- PDF
- Quiz
- Worksheet
- Audio
- Presentation

---

# Recommended for You

The platform can recommend learning resources based on student performance.

### Example

If a student scores **45%** in a Mathematics quiz, the system can recommend:

**Fractions: Introduction**

- Read the lesson
- Watch a video
- Complete a worksheet
- Take a follow-up quiz

This changes the platform from a simple resource library into a more personalized learning system.

---

# Practice Zone

Learning should follow a complete cycle:

**Learn → Practice → Take Quiz → View Result → Recommended Resources**

Students should be able to move from studying a topic to practicing and testing their understanding.

---

# Exam Preparation

The Learning Hub can contain dedicated examination preparation sections.

## BECE Preparation

Possible subjects:

- Mathematics
- English
- Basic Science
- Civic Education

## WAEC Preparation

Possible subjects:

- Mathematics
- English
- Biology
- Chemistry
- Physics
- Economics
- Government
- Literature

## JAMB Preparation

Possible subjects:

- Mathematics
- English
- Physics
- Chemistry
- Biology
- Economics
- Government

### Exam Preparation Resources

Each section can contain:

- Practice questions
- Mock tests
- Revision notes
- Topic explanations
- Previous-question practice where legally permitted

---

# Resource Approval Workflow

To maintain quality and safety, teacher-uploaded resources should not immediately become visible to students.

### Workflow

```text
Teacher uploads resource
        ↓
Pending Review
        ↓
School Administrator reviews
        ↓
Approve / Reject / Edit
        ↓
Published
        ↓
Students can access resource
```

This gives the school control over the content available to students.

---

# Resource Details Page

When a student opens a resource, the page should display:

- Resource title
- Subject
- Class
- Topic
- Uploader
- Estimated learning time
- Learning objectives
- Main resource
- Related resources
- Mark as Complete button

### Learning Objectives Example

After completing a lesson on Photosynthesis, students should be able to:

- Define photosynthesis
- Explain the process
- Identify materials required
- Explain the importance of photosynthesis

---

# Progress Tracking

The system should track:

- Resources opened
- Lessons completed
- Videos watched
- Quizzes attempted
- Quiz scores
- Assignments completed
- Learning time
- Topics mastered

### Teacher Progress View

| Student | Mathematics | English | Science |
|---|---:|---:|---:|
| Adewale | 85% | 72% | 91% |
| Aisha | 64% | 88% | 75% |
| Daniel | 42% | 67% | 59% |

This helps teachers identify students who may need additional support.

---

# Offline and Low-Data Learning

The platform should consider students who have limited internet access.

### Possible Features

- Download PDF notes
- Download worksheets
- Download audio lessons
- Download selected videos
- Data Saver Mode
- Compressed images
- Low-resolution videos
- Text-first lessons
- Smaller file downloads

This is especially useful for a Nigerian school-focused platform.

---

# Gamification

Gamification can encourage students to remain active.

Students can earn **Learning Points** for:

- Completing lessons
- Passing quizzes
- Reading resources
- Completing assignments
- Maintaining learning streaks

### Example

```text
- 5-Day Learning Streak
- Top Quiz Scorer
- Mathematics Master
```

An optional class leaderboard can also be included. Schools should be able to disable the leaderboard if they do not want competitive rankings.

---

# School Learning Analytics

Analytics help the school understand how students are using the platform.

### Admin Overview

Possible metrics:

- Total Resources
- Active Students
- Lessons Completed
- Quizzes Taken
- Most Popular Subject
- Most Accessed Topic

### Example

| Class | Subject | Average |
|---|---|---:|
| JSS 2A | Mathematics | 48% |
| JSS 3B | Basic Science | 52% |
| SS1A | Physics | 55% |

This can help schools identify topics where students are struggling and encourage teachers to provide additional learning materials.

---

# Recommended Dashboard Structure

## Student

- Dashboard
- My Subjects
- Learning Library
- Recommended
- My Progress
- Assignments
- Quizzes
- Exam Preparation
- Achievements

## Teacher

- Dashboard
- My Classes
- My Resources
- Upload Resource
- Assignments
- Quizzes
- Student Progress
- Resource Analytics

## School Admin

- Dashboard
- Students
- Teachers
- Classes
- Subjects
- Resource Library
- Pending Resources
- Curriculum
- Analytics
- Settings

## Parent

- Dashboard
- Child's Progress
- Learning Activity
- Assignments
- Results

---

# Recommended Technology Stack

The initial front end should remain lightweight and easy to maintain.

### HTML

Used for semantic page structure across:

- Dashboards
- Resource library
- Upload forms
- Analytics pages
- Login pages

### CSS

Used for:

- Custom styling
- Branding
- Layout refinement
- Responsive design

### Bootstrap

Used for:

- Responsive grid
- Navigation
- Cards
- Tables
- Modals
- Forms
- Badges
- Layout components

### JavaScript

Use JavaScript only where needed for interactivity, such as:

- Search
- Filters
- Form validation
- Progress indicators
- Dashboard interactions
- Simple client-side functionality

The goal is a clean, responsive, component-driven front end without depending on a heavy JavaScript framework.

---

# MVP — Minimum Viable Product

For the first version, focus on these eight core features:

1. School/Admin login
2. Teacher login
3. Student login
4. Classes and subjects
5. Digital resource library
6. Teacher resource upload and admin approval
7. Quizzes and assignments
8. Student progress dashboard

### Phase 2 Features

The following can be added after the MVP:

- AI-powered recommendations
- Gamification
- Offline mode
- Parent portal
- Advanced analytics
- More examination preparation tools

This approach keeps the first version realistic while making the product useful enough for a school to adopt.

---

# Product Positioning

LearnBridge should not be presented as simply:

> "A free library of educational resources."

That makes it sound like a static collection of PDFs and videos.

Instead, position it as:

> **Amule Government Secondary School's digital learning hub that gives every student access to approved learning materials, practice activities, and additional support — regardless of their ability to afford private tutoring.**

The product can be viewed as a combination of:

**Lightweight LMS + Digital Library + Personalized Learning Center**

---

# Project Vision

The long-term vision of LearnBridge is to help schools create a more equal learning environment where students can continue learning beyond the classroom.

The platform should make quality learning resources:

- Accessible
- Organized
- School-approved
- Easy to discover
- Free for students
- Trackable by teachers
- Manageable by schools

Ultimately, LearnBridge should help schools move from simply **providing lessons** to providing students with a complete environment for **learning, practicing, assessing, and improving**.

---

## Suggested MVP User Flow

```text
School Admin
     ↓
Creates Classes & Subjects
     ↓
Adds Teachers & Students
     ↓
Teacher Uploads Resource
     ↓
Admin Approves Resource
     ↓
Resource Published
     ↓
Student Finds Resource
     ↓
Student Learns
     ↓
Student Practices
     ↓
Student Takes Quiz
     ↓
Progress Recorded
     ↓
Teacher Monitors Progress
     ↓
Student Receives Additional Support
```

---

## License

This project is intended as a school-focused educational technology product. Add an appropriate open-source or proprietary license when the project is published.
