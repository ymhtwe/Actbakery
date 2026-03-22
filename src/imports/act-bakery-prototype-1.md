project_name: ACT Bakery Stock System

pages:
  - name: Login Page
    frame_size: 1440x1024
    layout: centered_card
    design:
      background: soft warm gradient (cream to light brown)
      card:
        width: 420px
        padding: 32px
        border_radius: 16px
        shadow: soft
        elements:
          - logo_placeholder_circle_with_bakery_icon
          - heading_large:
              text: "အောင်ချမ်းသာ Bakery"
          - subheading_small:
              text: "Production & Stock Management System"
          - input_email:
              label: "Email"
              placeholder: "Enter your email"
          - input_password:
              label: "Password"
              placeholder: ""
          - button_login:
              text: "Login"
              full_width: true
              color: #8B4513
          - error_message_text:
              text: "Invalid email"
              visible: false

  - name: Staff Data Entry Page
    frame_size: 1440x1024
    layout: simple_top_header
    design:
      header:
        text: "Staff Data Entry - Scan Page"
      content_placeholder:
        text: "Barcode Scan Interface (Design later)"
      logout_button_top_right: true

  - name: Admin Dashboard Page
    frame_size: 1440x1024
    layout: sidebar_dashboard
    design:
      sidebar:
        items:
          - Dashboard
          - Reports
          - Inventory
          - Logout
      main_area:
        header: "Admin Dashboard"
        analytics_placeholder: true

prototype_flow:
  start_from: "Login Page"
  interactions:
    - element: button_login
      on_click:
        if_email_equals: "user@gmail.com"
        navigate_to: "Staff Data Entry Page"

    - element: button_login
      on_click:
        if_email_equals: "redspot604@gmail.com"
        navigate_to: "Admin Dashboard Page"

    - element: button_login
      on_click:
        else:
          show: error_message_text

notes:
  - Password validation will be implemented later
  - This is UI prototype only
  - Use Auto Layout for all components
  - Create reusable components for input and button