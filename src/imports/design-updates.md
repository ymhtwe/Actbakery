update_existing_design: true
scope:
  - Admin Dashboard Page
  - Reports Page
  - Inventory Page

layout_fixes:
  header_alignment:
    rule: "All admin pages must share the exact same top header layout and spacing"
    top_header:
      height: 72px
      background: "#FFFFFF"
      border_bottom: "1px solid #E5E7EB"
      left_padding: 24px
      right_padding: 24px
      elements:
        - page_title_left
        - optional_breadcrumb
        - user_avatar_right
    content_container:
      max_width: 1200px
      left_alignment: "align to header title start"
      top_spacing_from_header: 24px

global_filters_component:
  name: "Analytics Filter Bar"
  placement:
    dashboard: "below header, above product summary"
    reports: "below header, above charts"
  style:
    background: "#FFFFFF"
    border: "1px solid #E5E7EB"
    radius: 12px
    padding: 16px
    shadow: subtle
  elements:
    - date_range_picker:
        label: "Date Range"
        default: "Last 7 Days"
        with_calendar: true
    - quick_range_chips:
        label: "Quick Range"
        chips:
          - "7 Days"
          - "14 Days"
          - "30 Days"
          - "This Month"
          - "Custom"
    - item_dropdown:
        label: "Item"
        default: "All Items"
        options:
          - "All Items"
          - "ဖရုံ"
          - "ကိတ်စို"
          - "d/c ကြီး"
          - "d/c သေး"
          - "နကထိုင်"
          - "Bကြီး"
          - "ယို၅"
          - "ယို၉"
    - apply_button:
        text: "Apply"
        style: primary
    - reset_link:
        text: "Reset"

dashboard_updates:
  keep_existing:
    - product_summary_cards
  add_sections:
    - section_title: "Trends"
      description: "View production by date range and item filter"
      charts:
        - chart_1:
            title: "Daily Production Trend"
            type: line_chart
            x_axis: "Date (Day-by-Day)"
            y_axis: "Count"
            behavior:
              if_item_selected: "show only selected item trend"
              if_all_items: "show stacked or total trend"
        - chart_2:
            title: "Top Items (Selected Range)"
            type: horizontal_bar_chart
            behavior:
              if_item_selected: "hide this chart"
              if_all_items: "show ranking"
  add_kpi_row:
    kpis:
      - name: "Total Produced"
      - name: "Total Adjustments"
      - name: "Net Total"
      - name: "Days Covered"

reports_page_redesign:
  replace_placeholder: true
  layout:
    - top: "Analytics Filter Bar"
    - middle:
        tabs:
          - name: "Overview"
          - name: "By Item"
          - name: "Adjustments Log"
    - overview_tab:
        content:
          - chart: "All Items Daily Total"
          - table: "Daily Summary Table"
    - by_item_tab:
        content:
          - item_picker: "same dropdown + search"
          - chart: "Selected Item Daily Trend"
          - summary_cards:
              - "Total Produced"
              - "Average per Day"
              - "Highest Day"
              - "Lowest Day"
          - table: "Day-by-Day counts for selected item"
    - adjustments_log_tab:
        content:
          - table_columns:
              - timestamp
              - item
              - type (SCAN/ADJUST)
              - qty_change
              - user
              - note

inventory_page_updates:
  add_filters_above_table:
    - search_input: "Search item name"
    - status_filter: ["All", "In Stock", "Low Stock", "Critical"]
  table_updates:
    columns:
      - Product
      - Today Produced
      - Current Stock
      - Status
      - View Trend button

interactions_prototype:
  - when_click_view_trend_on_item:
      navigate_to: "Reports Page"
      open_tab: "By Item"
      preselect_item: "clicked item"
      range_default: "7 Days"